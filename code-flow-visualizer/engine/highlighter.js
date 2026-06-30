/**
 * highlighter.js — Lightweight Syntax Highlighter
 * Highlights Python-like code with colorized tokens.
 * Pure regex-based tokenizer — no dependencies.
 */

const KEYWORDS = new Set([
  'and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del',
  'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
  'if', 'import', 'in', 'is', 'lambda', 'not', 'or', 'pass',
  'raise', 'return', 'try', 'while', 'with', 'yield'
]);

const BUILTINS = new Set([
  'print', 'len', 'range', 'int', 'str', 'float', 'bool',
  'abs', 'min', 'max', 'sum', 'type', 'input', 'round',
  'list', 'dict', 'set', 'tuple', 'sorted', 'reversed',
  'enumerate', 'zip', 'map', 'filter', 'isinstance', 'hasattr',
  'getattr', 'setattr', 'open', 'super'
]);

const BOOL_NONE = new Set(['True', 'False', 'None']);

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Highlight a single line of Python-like code.
 * Returns HTML string with <span class="syn-*"> tokens.
 */
export function highlightLine(line) {
  if (!line) return '';
  
  let result = '';
  let i = 0;
  
  while (i < line.length) {
    // --- Whitespace ---
    if (line[i] === ' ' || line[i] === '\t') {
      let ws = '';
      while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
        ws += line[i];
        i++;
      }
      result += ws;
      continue;
    }
    
    // --- Comments ---
    if (line[i] === '#') {
      result += `<span class="syn-comment">${escapeHtml(line.slice(i))}</span>`;
      break;
    }
    
    // --- f-strings ---
    if ((line[i] === 'f' || line[i] === 'F') && i + 1 < line.length && (line[i + 1] === '"' || line[i + 1] === "'")) {
      const quote = line[i + 1];
      const tripleQuote = line.slice(i + 1, i + 4) === quote.repeat(3);
      const endQuote = tripleQuote ? quote.repeat(3) : quote;
      let j = i + 1 + (tripleQuote ? 3 : 1);
      let fstr = `<span class="syn-string">f${tripleQuote ? endQuote : quote}`;
      let braceDepth = 0;
      
      while (j < line.length) {
        if (line[j] === '\\' && j + 1 < line.length) {
          fstr += escapeHtml(line.slice(j, j + 2));
          j += 2;
          continue;
        }
        if (line[j] === '{' && line[j + 1] !== '{') {
          fstr += `</span><span class="syn-fstring-brace">{</span>`;
          braceDepth++;
          j++;
          // Highlight content inside braces
          let inner = '';
          while (j < line.length && !(line[j] === '}' && braceDepth > 0)) {
            inner += line[j];
            j++;
          }
          fstr += highlightLine(inner);
          if (j < line.length && line[j] === '}') {
            fstr += `<span class="syn-fstring-brace">}</span><span class="syn-string">`;
            braceDepth--;
            j++;
          }
          continue;
        }
        if (line[j] === '{' && line[j + 1] === '{') {
          fstr += '{{';
          j += 2;
          continue;
        }
        if (line[j] === '}' && line[j + 1] === '}') {
          fstr += '}}';
          j += 2;
          continue;
        }
        if (!tripleQuote && line[j] === quote) {
          fstr += `${quote}</span>`;
          j++;
          i = j;
          result += fstr;
          fstr = null;
          break;
        }
        if (tripleQuote && line.slice(j, j + 3) === endQuote) {
          fstr += `${endQuote}</span>`;
          j += 3;
          i = j;
          result += fstr;
          fstr = null;
          break;
        }
        fstr += escapeHtml(line[j]);
        j++;
      }
      if (fstr !== null) {
        fstr += '</span>';
        result += fstr;
        i = j;
      }
      continue;
    }
    
    // --- Strings (single/double, triple-quoted) ---
    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i];
      const triple = line.slice(i, i + 3) === quote.repeat(3);
      const end = triple ? quote.repeat(3) : quote;
      let j = i + (triple ? 3 : 1);
      let str = end.length === 3 ? quote.repeat(3) : quote;
      
      while (j < line.length) {
        if (line[j] === '\\' && j + 1 < line.length) {
          str += line.slice(j, j + 2);
          j += 2;
          continue;
        }
        if (!triple && line[j] === quote) {
          str += quote;
          j++;
          break;
        }
        if (triple && line.slice(j, j + 3) === end) {
          str += end;
          j += 3;
          break;
        }
        str += line[j];
        j++;
      }
      result += `<span class="syn-string">${escapeHtml(str)}</span>`;
      i = j;
      continue;
    }
    
    // --- Numbers ---
    if (/[0-9]/.test(line[i]) || (line[i] === '.' && i + 1 < line.length && /[0-9]/.test(line[i + 1]))) {
      let num = '';
      // Hex
      if (line[i] === '0' && i + 1 < line.length && (line[i + 1] === 'x' || line[i + 1] === 'X')) {
        num = '0' + line[i + 1];
        i += 2;
        while (i < line.length && /[0-9a-fA-F_]/.test(line[i])) {
          num += line[i];
          i++;
        }
      } else {
        while (i < line.length && /[0-9_.]/.test(line[i])) {
          num += line[i];
          i++;
        }
        // Scientific notation
        if (i < line.length && (line[i] === 'e' || line[i] === 'E')) {
          num += line[i];
          i++;
          if (i < line.length && (line[i] === '+' || line[i] === '-')) {
            num += line[i];
            i++;
          }
          while (i < line.length && /[0-9]/.test(line[i])) {
            num += line[i];
            i++;
          }
        }
      }
      result += `<span class="syn-number">${escapeHtml(num)}</span>`;
      continue;
    }
    
    // --- Identifiers / Keywords ---
    if (/[a-zA-Z_]/.test(line[i])) {
      let ident = '';
      while (i < line.length && /[a-zA-Z0-9_]/.test(line[i])) {
        ident += line[i];
        i++;
      }
      
      if (BOOL_NONE.has(ident)) {
        result += `<span class="syn-bool">${ident}</span>`;
      } else if (KEYWORDS.has(ident)) {
        result += `<span class="syn-keyword">${ident}</span>`;
      } else if (ident === 'self') {
        result += `<span class="syn-self">${ident}</span>`;
      } else if (BUILTINS.has(ident)) {
        result += `<span class="syn-builtin">${ident}</span>`;
      } else {
        // Check if followed by '(' -> function call
        let k = i;
        while (k < line.length && line[k] === ' ') k++;
        if (k < line.length && line[k] === '(') {
          result += `<span class="syn-function">${escapeHtml(ident)}</span>`;
        } else {
          result += `<span class="syn-variable">${escapeHtml(ident)}</span>`;
        }
      }
      continue;
    }
    
    // --- Operators ---
    if ('+-*/%=<>!&|^~@'.includes(line[i])) {
      let op = line[i];
      i++;
      // Multi-char operators: ==, !=, <=, >=, **, //, ->, +=, -=, *=, /=
      if (i < line.length) {
        const two = op + line[i];
        if (['==', '!=', '<=', '>=', '**', '//', '->', '+=', '-=', '*=', '/=', '%=', '<<', '>>', '|=', '&=', '^='].includes(two)) {
          op = two;
          i++;
        }
      }
      result += `<span class="syn-operator">${escapeHtml(op)}</span>`;
      continue;
    }
    
    // --- Parentheses, brackets, braces ---
    if ('()[]{}:,;.'.includes(line[i])) {
      result += `<span class="syn-paren">${escapeHtml(line[i])}</span>`;
      i++;
      continue;
    }
    
    // --- Decorator ---
    if (line[i] === '@') {
      let dec = '@';
      i++;
      while (i < line.length && /[a-zA-Z0-9_.]/.test(line[i])) {
        dec += line[i];
        i++;
      }
      result += `<span class="syn-decorator">${escapeHtml(dec)}</span>`;
      continue;
    }
    
    // --- Anything else ---
    result += escapeHtml(line[i]);
    i++;
  }
  
  return result;
}

/**
 * Highlight all lines of code. Returns array of HTML strings.
 */
export function highlightCode(code) {
  const lines = code.split('\n');
  return lines.map(line => highlightLine(line));
}
