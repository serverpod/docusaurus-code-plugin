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
exports.fetchCodeFromFile = exports.fetchCodeFromUrl = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const fs_1 = __importDefault(require("fs"));
const fetchCodeFromUrl = (url) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield node_fetch_1.default(url);
    const content = yield response.text();
    return content.split(/\r?\n/);
});
exports.fetchCodeFromUrl = fetchCodeFromUrl;
const fetchCodeFromFile = (fileName) => {
    let name = fileName;
    if (!fileName.startsWith("/"))
        name = process.cwd() + "/" + name;
    return fs_1.default.readFileSync(name, "utf-8").split(/\r?\n/);
};
exports.fetchCodeFromFile = fetchCodeFromFile;
