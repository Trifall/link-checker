import { u as RawConfig } from "./types-DUEIJGhR.mjs";

//#region node_modules/.pnpm/@actions+core@3.0.0/node_modules/@actions/core/lib/summary.d.ts
type SummaryTableRow = (SummaryTableCell | string)[];
interface SummaryTableCell {
  /**
   * Cell content
   */
  data: string;
  /**
   * Render cell as header
   * (optional) default: false
   */
  header?: boolean;
  /**
   * Number of columns the cell extends
   * (optional) default: '1'
   */
  colspan?: string;
  /**
   * Number of rows the cell extends
   * (optional) default: '1'
   */
  rowspan?: string;
}
interface SummaryImageOptions {
  /**
   * The width of the image in pixels. Must be an integer without a unit.
   * (optional)
   */
  width?: string;
  /**
   * The height of the image in pixels. Must be an integer without a unit.
   * (optional)
   */
  height?: string;
}
interface SummaryWriteOptions {
  /**
   * Replace all existing content in summary file with buffer contents
   * (optional) default: false
   */
  overwrite?: boolean;
}
declare class Summary {
  private _buffer;
  private _filePath?;
  constructor();
  /**
   * Finds the summary file path from the environment, rejects if env var is not found or file does not exist
   * Also checks r/w permissions.
   *
   * @returns step summary file path
   */
  private filePath;
  /**
   * Wraps content in an HTML tag, adding any HTML attributes
   *
   * @param {string} tag HTML tag to wrap
   * @param {string | null} content content within the tag
   * @param {[attribute: string]: string} attrs key-value list of HTML attributes to add
   *
   * @returns {string} content wrapped in HTML element
   */
  private wrap;
  /**
   * Writes text in the buffer to the summary buffer file and empties buffer. Will append by default.
   *
   * @param {SummaryWriteOptions} [options] (optional) options for write operation
   *
   * @returns {Promise<Summary>} summary instance
   */
  write(options?: SummaryWriteOptions): Promise<Summary>;
  /**
   * Clears the summary buffer and wipes the summary file
   *
   * @returns {Summary} summary instance
   */
  clear(): Promise<Summary>;
  /**
   * Returns the current summary buffer as a string
   *
   * @returns {string} string of summary buffer
   */
  stringify(): string;
  /**
   * If the summary buffer is empty
   *
   * @returns {boolen} true if the buffer is empty
   */
  isEmptyBuffer(): boolean;
  /**
   * Resets the summary buffer without writing to summary file
   *
   * @returns {Summary} summary instance
   */
  emptyBuffer(): Summary;
  /**
   * Adds raw text to the summary buffer
   *
   * @param {string} text content to add
   * @param {boolean} [addEOL=false] (optional) append an EOL to the raw text (default: false)
   *
   * @returns {Summary} summary instance
   */
  addRaw(text: string, addEOL?: boolean): Summary;
  /**
   * Adds the operating system-specific end-of-line marker to the buffer
   *
   * @returns {Summary} summary instance
   */
  addEOL(): Summary;
  /**
   * Adds an HTML codeblock to the summary buffer
   *
   * @param {string} code content to render within fenced code block
   * @param {string} lang (optional) language to syntax highlight code
   *
   * @returns {Summary} summary instance
   */
  addCodeBlock(code: string, lang?: string): Summary;
  /**
   * Adds an HTML list to the summary buffer
   *
   * @param {string[]} items list of items to render
   * @param {boolean} [ordered=false] (optional) if the rendered list should be ordered or not (default: false)
   *
   * @returns {Summary} summary instance
   */
  addList(items: string[], ordered?: boolean): Summary;
  /**
   * Adds an HTML table to the summary buffer
   *
   * @param {SummaryTableCell[]} rows table rows
   *
   * @returns {Summary} summary instance
   */
  addTable(rows: SummaryTableRow[]): Summary;
  /**
   * Adds a collapsable HTML details element to the summary buffer
   *
   * @param {string} label text for the closed state
   * @param {string} content collapsable content
   *
   * @returns {Summary} summary instance
   */
  addDetails(label: string, content: string): Summary;
  /**
   * Adds an HTML image tag to the summary buffer
   *
   * @param {string} src path to the image you to embed
   * @param {string} alt text description of the image
   * @param {SummaryImageOptions} options (optional) addition image attributes
   *
   * @returns {Summary} summary instance
   */
  addImage(src: string, alt: string, options?: SummaryImageOptions): Summary;
  /**
   * Adds an HTML section heading element
   *
   * @param {string} text heading text
   * @param {number | string} [level=1] (optional) the heading level, default: 1
   *
   * @returns {Summary} summary instance
   */
  addHeading(text: string, level?: number | string): Summary;
  /**
   * Adds an HTML thematic break (<hr>) to the summary buffer
   *
   * @returns {Summary} summary instance
   */
  addSeparator(): Summary;
  /**
   * Adds an HTML line break (<br>) to the summary buffer
   *
   * @returns {Summary} summary instance
   */
  addBreak(): Summary;
  /**
   * Adds an HTML blockquote to the summary buffer
   *
   * @param {string} text quote text
   * @param {string} cite (optional) citation url
   *
   * @returns {Summary} summary instance
   */
  addQuote(text: string, cite?: string): Summary;
  /**
   * Adds an HTML anchor tag to the summary buffer
   *
   * @param {string} text link text/content
   * @param {string} href hyperlink
   *
   * @returns {Summary} summary instance
   */
  addLink(text: string, href: string): Summary;
}
/**
 * @deprecated use `core.summary`
 */
declare const markdownSummary: Summary;
declare const summary: Summary;
//#endregion
//#region node_modules/.pnpm/@actions+core@3.0.0/node_modules/@actions/core/lib/path-utils.d.ts
/**
 * toPosixPath converts the given path to the posix form. On Windows, \\ will be
 * replaced with /.
 *
 * @param pth. Path to transform.
 * @return string Posix path.
 */
declare function toPosixPath(pth: string): string;
/**
 * toWin32Path converts the given path to the win32 form. On Linux, / will be
 * replaced with \\.
 *
 * @param pth. Path to transform.
 * @return string Win32 path.
 */
declare function toWin32Path(pth: string): string;
/**
 * toPlatformPath converts the given path to a platform-specific path. It does
 * this by replacing instances of / and \ with the platform-specific path
 * separator.
 *
 * @param pth The path to platformize.
 * @return string The platform-specific path.
 */
declare function toPlatformPath(pth: string): string;
declare namespace platform_d_exports {
  export { arch, getDetails, isLinux, isMacOS, isWindows, platform };
}
declare const platform: NodeJS.Platform;
declare const arch: NodeJS.Architecture;
declare const isWindows: boolean;
declare const isMacOS: boolean;
declare const isLinux: boolean;
declare function getDetails(): Promise<{
  name: string;
  platform: string;
  arch: string;
  version: string;
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
}>;
declare namespace core_d_exports {
  export { AnnotationProperties, ExitCode, InputOptions, addPath, debug, endGroup, error, exportVariable, getBooleanInput, getIDToken, getInput, getMultilineInput, getState, group, info, isDebug, markdownSummary, notice, platform_d_exports as platform, saveState, setCommandEcho, setFailed, setOutput, setSecret, startGroup, summary, toPlatformPath, toPosixPath, toWin32Path, warning };
}
/**
 * Interface for getInput options
 */
interface InputOptions {
  /** Optional. Whether the input is required. If required and not present, will throw. Defaults to false */
  required?: boolean;
  /** Optional. Whether leading/trailing whitespace will be trimmed for the input. Defaults to true */
  trimWhitespace?: boolean;
}
/**
 * The code to exit an action
 */
declare enum ExitCode {
  /**
   * A code indicating that the action was successful
   */
  Success = 0,
  /**
   * A code indicating that the action was a failure
   */
  Failure = 1
}
/**
 * Optional properties that can be sent with annotation commands (notice, error, and warning)
 * See: https://docs.github.com/en/rest/reference/checks#create-a-check-run for more information about annotations.
 */
interface AnnotationProperties {
  /**
   * A title for the annotation.
   */
  title?: string;
  /**
   * The path of the file for which the annotation should be created.
   */
  file?: string;
  /**
   * The start line for the annotation.
   */
  startLine?: number;
  /**
   * The end line for the annotation. Defaults to `startLine` when `startLine` is provided.
   */
  endLine?: number;
  /**
   * The start column for the annotation. Cannot be sent when `startLine` and `endLine` are different values.
   */
  startColumn?: number;
  /**
   * The end column for the annotation. Cannot be sent when `startLine` and `endLine` are different values.
   * Defaults to `startColumn` when `startColumn` is provided.
   */
  endColumn?: number;
}
/**
 * Sets env variable for this action and future actions in the job
 * @param name the name of the variable to set
 * @param val the value of the variable. Non-string values will be converted to a string via JSON.stringify
 */
declare function exportVariable(name: string, val: any): void;
/**
 * Registers a secret which will get masked from logs
 *
 * @param secret - Value of the secret to be masked
 * @remarks
 * This function instructs the Actions runner to mask the specified value in any
 * logs produced during the workflow run. Once registered, the secret value will
 * be replaced with asterisks (***) whenever it appears in console output, logs,
 * or error messages.
 *
 * This is useful for protecting sensitive information such as:
 * - API keys
 * - Access tokens
 * - Authentication credentials
 * - URL parameters containing signatures (SAS tokens)
 *
 * Note that masking only affects future logs; any previous appearances of the
 * secret in logs before calling this function will remain unmasked.
 *
 * @example
 * ```typescript
 * // Register an API token as a secret
 * const apiToken = "abc123xyz456";
 * setSecret(apiToken);
 *
 * // Now any logs containing this value will show *** instead
 * console.log(`Using token: ${apiToken}`); // Outputs: "Using token: ***"
 * ```
 */
declare function setSecret(secret: string): void;
/**
 * Prepends inputPath to the PATH (for this action and future actions)
 * @param inputPath
 */
declare function addPath(inputPath: string): void;
/**
 * Gets the value of an input.
 * Unless trimWhitespace is set to false in InputOptions, the value is also trimmed.
 * Returns an empty string if the value is not defined.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   string
 */
declare function getInput(name: string, options?: InputOptions): string;
/**
 * Gets the values of an multiline input.  Each value is also trimmed.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   string[]
 *
 */
declare function getMultilineInput(name: string, options?: InputOptions): string[];
/**
 * Gets the input value of the boolean type in the YAML 1.2 "core schema" specification.
 * Support boolean input list: `true | True | TRUE | false | False | FALSE` .
 * The return value is also in boolean type.
 * ref: https://yaml.org/spec/1.2/spec.html#id2804923
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   boolean
 */
declare function getBooleanInput(name: string, options?: InputOptions): boolean;
/**
 * Sets the value of an output.
 *
 * @param     name     name of the output to set
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
declare function setOutput(name: string, value: any): void;
/**
 * Enables or disables the echoing of commands into stdout for the rest of the step.
 * Echoing is disabled by default if ACTIONS_STEP_DEBUG is not set.
 *
 */
declare function setCommandEcho(enabled: boolean): void;
/**
 * Sets the action status to failed.
 * When the action exits it will be with an exit code of 1
 * @param message add error issue message
 */
declare function setFailed(message: string | Error): void;
/**
 * Gets whether Actions Step Debug is on or not
 */
declare function isDebug(): boolean;
/**
 * Writes debug message to user log
 * @param message debug message
 */
declare function debug(message: string): void;
/**
 * Adds an error issue
 * @param message error issue message. Errors will be converted to string via toString()
 * @param properties optional properties to add to the annotation.
 */
declare function error(message: string | Error, properties?: AnnotationProperties): void;
/**
 * Adds a warning issue
 * @param message warning issue message. Errors will be converted to string via toString()
 * @param properties optional properties to add to the annotation.
 */
declare function warning(message: string | Error, properties?: AnnotationProperties): void;
/**
 * Adds a notice issue
 * @param message notice issue message. Errors will be converted to string via toString()
 * @param properties optional properties to add to the annotation.
 */
declare function notice(message: string | Error, properties?: AnnotationProperties): void;
/**
 * Writes info to log with console.log.
 * @param message info message
 */
declare function info(message: string): void;
/**
 * Begin an output group.
 *
 * Output until the next `groupEnd` will be foldable in this group
 *
 * @param name The name of the output group
 */
declare function startGroup(name: string): void;
/**
 * End an output group.
 */
declare function endGroup(): void;
/**
 * Wrap an asynchronous function call in a group.
 *
 * Returns the same type as the function itself.
 *
 * @param name The name of the group
 * @param fn The function to wrap in the group
 */
declare function group<T>(name: string, fn: () => Promise<T>): Promise<T>;
/**
 * Saves state for current action, the state can only be retrieved by this action's post job execution.
 *
 * @param     name     name of the state to store
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
declare function saveState(name: string, value: any): void;
/**
 * Gets the value of an state set by this action's main execution.
 *
 * @param     name     name of the state to get
 * @returns   string
 */
declare function getState(name: string): string;
declare function getIDToken(aud?: string): Promise<string>;
//#endregion
//#region src/action.d.ts
type ActionCore = Pick<typeof core_d_exports, "error" | "getInput" | "getMultilineInput" | "setFailed" | "setOutput" | "summary" | "warning">;
declare function readActionInputs(actionCore?: ActionCore): RawConfig;
declare function runAction(actionCore?: ActionCore): Promise<void>;
//#endregion
export { ActionCore, readActionInputs, runAction };
//# sourceMappingURL=action.d.mts.map