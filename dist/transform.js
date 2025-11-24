"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transform = exports.extractParam = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const unist_util_visit_1 = __importDefault(require("unist-util-visit"));
const fetchCode_1 = require("./fetchCode");
function get(v) {
    if (v === undefined) {
        throw new Error("Mandatory variable is not defined");
    }
    else {
        return v;
    }
}
// A code block that needs to be inserted into the md document.
class CodeBlock {
    constructor(node, fromUrl, lang, codeRef, title, doctag, originFile) {
        this.node = node;
        this.fromUrl = fromUrl;
        this.lang = lang;
        this.codeRef = codeRef;
        this.title = title;
        this.doctag = doctag;
        this.originFile = originFile;
        this.selectLines = (lines) => {
            if (this.doctag === undefined) {
                return lines;
            }
            else {
                const result = [];
                var collecting = false;
                const pattern = "doctag<" + this.doctag + ">";
                for (var line of lines) {
                    if (collecting) {
                        if (line.match("end:" + pattern) != null) {
                            break;
                        }
                        else {
                            result.push(line);
                        }
                    }
                    else {
                        collecting = line.match(pattern) != null;
                    }
                }
                return result;
            }
        };
        this.createNode = () => __awaiter(this, void 0, void 0, function* () {
            this.node.type = 'code';
            this.node.children = undefined;
            this.node.lang = this.lang;
            if (typeof this.title !== "undefined")
                this.node.meta = 'title="' + this.title + '"';
            const code = this.fromUrl ? (yield fetchCode_1.fetchCodeFromUrl(this.codeRef)) : fetchCode_1.fetchCodeFromFile(this.codeRef);
            const lines = this.selectLines(code);
            if (lines.length === 0) {
                const tagInfo = this.doctag ? ` (doctag "${this.doctag}")` : '';
                const fileInfo = this.originFile ? ` while processing "${this.originFile}"` : '';
                throw new Error(`blended-include-code-plugin: no lines selected from "${this.codeRef}"${tagInfo}${fileInfo}. Ensure the target file/document tag exists.`);
            }
            const trimmed = [...lines];
            while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === '') {
                trimmed.pop();
            }
            if (trimmed.length === 0) {
                const tagInfo = this.doctag ? ` (doctag "${this.doctag}")` : '';
                const fileInfo = this.originFile ? ` while processing "${this.originFile}"` : '';
                throw new Error(`blended-include-code-plugin: extracted content from "${this.codeRef}"${tagInfo}${fileInfo} is empty after trimming trailing blank lines.`);
            }
            this.node.value = trimmed.join("\n");
        });
    }
}
// doctag<extractParam>
// Take a string and extract a simple named parameter
function extractParam(name, input) {
    const regExp = /([a-z]+)=\"([^\"]+)\"/g;
    var result = undefined;
    var elem;
    while ((result == undefined) && (elem = regExp.exec(input)) !== null) {
        if (elem[1] == name)
            result = elem[2];
    }
    return result;
}
exports.extractParam = extractParam;
// end:doctag<extractParam>
const isRemoteUrl = (value) => /^https?:\/\//i.test(value);
const resolveCodeReference = (codeRef, originFile) => {
    if (isRemoteUrl(codeRef)) {
        return codeRef;
    }
    if (path_1.default.isAbsolute(codeRef)) {
        return codeRef;
    }
    if (originFile !== undefined) {
        const baseDir = path_1.default.dirname(originFile);
        const resolved = path_1.default.resolve(baseDir, codeRef);
        if (fs_1.default.existsSync(resolved)) {
            return resolved;
        }
    }
    return path_1.default.resolve(process.cwd(), codeRef);
};
const applyCodeBlock = (options, node, originFile) => {
    const { children } = node;
    let cb = undefined;
    try {
        if (children.length >= 1 && children[0].value.startsWith(options.marker)) {
            // Extract codeblock from filesystem 
            var codeRef = undefined;
            var pText = '';
            var fromUrl = false;
            if (children.length == 1) {
                codeRef = get(extractParam("file", children[0].value));
                pText = children[0].value;
                fromUrl = codeRef !== undefined && isRemoteUrl(codeRef);
            }
            else if (children.length >= 2) {
                for (var c of children) {
                    if (c.type == 'link' && codeRef === undefined)
                        codeRef = c.url;
                    if (c.type == 'text')
                        pText = pText + c.value + " ";
                }
                fromUrl = codeRef !== undefined && isRemoteUrl(codeRef);
            }
            const lang = get(extractParam("lang", pText));
            const title = extractParam("title", pText);
            const doctag = extractParam("doctag", pText);
            cb = new CodeBlock(node, fromUrl, lang, resolveCodeReference(get(codeRef), originFile), title, doctag, originFile);
        }
    }
    catch (e) {
        // do nothing 
    }
    return cb;
};
const getOriginFile = (file) => {
    if (file === null || file === void 0 ? void 0 : file.path) {
        return file.path;
    }
    if ((file === null || file === void 0 ? void 0 : file.history) && file.history.length > 0) {
        return file.history[file.history.length - 1];
    }
    return undefined;
};
const transform = (options) => (tree, file) => new Promise((resolve) => __awaiter(void 0, void 0, void 0, function* () {
    const nodesToChange = [];
    const originFile = getOriginFile(file);
    // First, collect all the node that need to be changed, so that 
    // we can iterate over them later on and fetch the file contents 
    // asynchronously 
    const visitor = (node) => {
        const cb = applyCodeBlock(options, node, originFile);
        if (cb !== undefined) {
            nodesToChange.push(cb);
        }
    };
    unist_util_visit_1.default(tree, 'paragraph', visitor);
    // Now go over the collected nodes and change them 
    for (const cb of nodesToChange) {
        yield cb.createNode();
    }
    resolve();
}));
exports.transform = transform;
