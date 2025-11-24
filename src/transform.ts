import path from 'path';
import visit from 'unist-util-visit';
import { fetchCodeFromFile, fetchCodeFromUrl } from './fetchCode';

type OptionString = string | undefined
type OptionCodeBlock = CodeBlock | undefined

function get<V>(v: (V | undefined)): V {
  if (v === undefined) {
    throw new Error("Mandatory variable is not defined")
  } else {
    return v
  }
}

export interface IncludeOptions {
  marker: string;
}

// A code block that needs to be inserted into the md document.
class CodeBlock {
  constructor(
    readonly node: any,
    readonly fromUrl: boolean,
    readonly lang: string,
    readonly codeRef: string,
    readonly title: OptionString,
    readonly doctag: OptionString,
    readonly originFile: OptionString
  ) { }

  private selectLines = (lines: string[]) => {

    if (this.doctag === undefined) {
      return lines;
    } else {
      const result: string[] = [];
      var collecting: boolean = false;

      const pattern = "doctag<" + this.doctag + ">";

      for (var line of lines) {
        if (collecting) {
          if (line.match("end:" + pattern) != null) {
            break;
          } else {
            result.push(line);
          }
        } else {
          collecting = line.match(pattern) != null;
        }
      }
      return result;
    }
  }

  createNode = async () => {
    this.node.type = 'code';
    this.node.children = undefined;
    this.node.lang = this.lang;
    if (typeof this.title !== "undefined") this.node.meta = 'title="' + this.title + '"';

    const code = this.fromUrl ? (await fetchCodeFromUrl(this.codeRef)) : fetchCodeFromFile(this.codeRef);
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
  }
}

// doctag<extractParam>
// Take a string and extract a simple named parameter
export function extractParam(name: string, input: string): OptionString {
  const regExp = /([a-z]+)=\"([^\"]+)\"/g

  var result = undefined
  var elem;
  while ((result == undefined) && (elem = regExp.exec(input)) !== null) {
    if (elem[1] == name) result = elem[2]
  }

  return result;
}
// end:doctag<extractParam>

const isRemoteUrl = (value: string) => /^https?:\/\//i.test(value);

const resolveCodeReference = (codeRef: string, originFile: OptionString) => {
  if (isRemoteUrl(codeRef) || path.isAbsolute(codeRef) || originFile === undefined) {
    return codeRef;
  }

  const baseDir = path.dirname(originFile);
  return path.resolve(baseDir, codeRef);
};

const applyCodeBlock = (options: IncludeOptions, node: any, originFile: OptionString) => {
  const { children } = node

  let cb = undefined

  try {
    if (children.length >= 1 && children[0].value.startsWith(options.marker)) {
      // Extract codeblock from filesystem 

      var codeRef: OptionString = undefined;
      var pText: string = '';
      var fromUrl: boolean = false;

      if (children.length == 1) {
        codeRef = get(extractParam("file", children[0].value));
        pText = children[0].value;
        fromUrl = codeRef !== undefined && isRemoteUrl(codeRef);
      } else if (children.length >= 2) {
        for (var c of children) {
          if (c.type == 'link' && codeRef === undefined) codeRef = c.url
          if (c.type == 'text') pText = pText + c.value + " "
        }
        fromUrl = codeRef !== undefined && isRemoteUrl(codeRef);
      }

      const lang = get(extractParam("lang", pText));
      const title = extractParam("title", pText);
      const doctag = extractParam("doctag", pText);

      cb = new CodeBlock(
        node,
        fromUrl,
        lang,
        resolveCodeReference(get(codeRef), originFile),
        title,
        doctag,
        originFile
      )
    }
  } catch (e) {
    // do nothing 
  }

  return cb;
}

const getOriginFile = (file?: { path?: string, history?: string[] }): OptionString => {
  if (file?.path) {
    return file.path;
  }

  if (file?.history && file.history.length > 0) {
    return file.history[file.history.length - 1];
  }

  return undefined;
};

export const transform = (options: IncludeOptions) => (tree: any, file?: { path?: string, history?: string[] }) => new Promise<void>(async (resolve) => {

  const nodesToChange: CodeBlock[] = [];
  const originFile = getOriginFile(file);

  // First, collect all the node that need to be changed, so that 
  // we can iterate over them later on and fetch the file contents 
  // asynchronously 
  const visitor = (node: any) => {
    const cb = applyCodeBlock(options, node, originFile);
    if (cb !== undefined) {
      nodesToChange.push(cb)
    }
  };

  visit(tree, 'paragraph', visitor);

  // Now go over the collected nodes and change them 
  for (const cb of nodesToChange) {
    await cb.createNode()
  }

  resolve();
});