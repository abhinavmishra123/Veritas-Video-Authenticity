import { parseCode } from './parser.js';
/* ========================================================================
   §1  EXPRESSION TOKENISER
   ======================================================================== */
const TOKEN = Object.freeze({
  NUMBER:  'NUMBER',
  STRING:  'STRING',
  IDENT:   'IDENT',
  OP:      'OP',
  LPAREN:  'LPAREN',
  RPAREN:  'RPAREN',
  LBRACKET:'LBRACKET',
  RBRACKET:'RBRACKET',
  LBRACE:  'LBRACE',
  RBRACE:  'RBRACE',
  COMMA:   'COMMA',
  COLON:   'COLON',
  DOT:     'DOT',
  EOF:     'EOF',
  KEYWORD: 'KEYWORD',
});
const KEYWORDS_SET = new Set([
  'and', 'or', 'not', 'in', 'True', 'False', 'None', 'is',
]);
/**
 * Tokenise a Python-like expression string into an array of token objects.
 * Each token: { type, value, raw }
 */
function tokenise(expr) {
  const tokens = [];
  let i = 0;
  const src = expr;
  function peek(offset = 0) { return src[i + offset]; }
  function advance() { return src[i++]; }
  while (i < src.length) {
    let ch = src[i];
    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }
    // Numbers
    if (ch >= '0' && ch <= '9') {
      let num = '';
      while (i < src.length && ((src[i] >= '0' && src[i] <= '9') || src[i] === '.')) {
        num += advance();
      }
      tokens.push({ type: TOKEN.NUMBER, value: num.includes('.') ? parseFloat(num) : parseInt(num, 10), raw: num });
      continue;
    }
    // Strings (single, double, triple-quoted, f-strings)
    if (ch === '"' || ch === "'" || (ch === 'f' && (peek(1) === '"' || peek(1) === "'"))) {
      let isFString = false;
      if (ch === 'f') { isFString = true; advance(); ch = src[i]; }
      let quote = ch;
      let triple = false;
      advance(); // consume opening quote
      if (i + 1 < src.length && src[i] === quote && src[i + 1] === quote) {
        triple = true;
        advance(); advance();
      }
      let str = '';
      const endSeq = triple ? quote + quote + quote : quote;
      while (i < src.length) {
        if (src[i] === '\\' && i + 1 < src.length) {
          const escaped = src[i + 1];
          if (escaped === 'n') { str += '\n'; i += 2; }
          else if (escaped === 't') { str += '\t'; i += 2; }
          else if (escaped === '\\') { str += '\\'; i += 2; }
          else if (escaped === quote) { str += quote; i += 2; }
          else { str += src[i + 1]; i += 2; }
          continue;
        }
        if (!triple && src[i] === quote) { advance(); break; }
        if (triple && src.slice(i, i + 3) === endSeq) { i += 3; break; }
        str += advance();
      }
      tokens.push({ type: TOKEN.STRING, value: str, raw: str, isFString });
      continue;
    }
    // Identifiers & keywords
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let ident = '';
      while (
        i < src.length &&
        ((src[i] >= 'a' && src[i] <= 'z') ||
         (src[i] >= 'A' && src[i] <= 'Z') ||
         (src[i] >= '0' && src[i] <= '9') ||
         src[i] === '_')
      ) {
        ident += advance();
      }
      if (ident === 'True') tokens.push({ type: TOKEN.KEYWORD, value: true, raw: ident });
      else if (ident === 'False') tokens.push({ type: TOKEN.KEYWORD, value: false, raw: ident });
      else if (ident === 'None') tokens.push({ type: TOKEN.KEYWORD, value: null, raw: ident });
      else if (KEYWORDS_SET.has(ident)) tokens.push({ type: TOKEN.KEYWORD, value: ident, raw: ident });
      else tokens.push({ type: TOKEN.IDENT, value: ident, raw: ident });
      continue;
    }
    // Two-char operators
    if (i + 1 < src.length) {
      const two = src[i] + src[i + 1];
      if (['==', '!=', '<=', '>=', '//', '**', '+=', '-=', '*=', '/=', '%='].includes(two)) {
        i += 2;
        tokens.push({ type: TOKEN.OP, value: two, raw: two });
        continue;
      }
    }
    // Single-char tokens
    if (ch === '(') { advance(); tokens.push({ type: TOKEN.LPAREN,   value: '(' }); continue; }
    if (ch === ')') { advance(); tokens.push({ type: TOKEN.RPAREN,   value: ')' }); continue; }
    if (ch === '[') { advance(); tokens.push({ type: TOKEN.LBRACKET, value: '[' }); continue; }
    if (ch === ']') { advance(); tokens.push({ type: TOKEN.RBRACKET, value: ']' }); continue; }
    if (ch === '{') { advance(); tokens.push({ type: TOKEN.LBRACE,   value: '{' }); continue; }
    if (ch === '}') { advance(); tokens.push({ type: TOKEN.RBRACE,   value: '}' }); continue; }
    if (ch === ',') { advance(); tokens.push({ type: TOKEN.COMMA,    value: ',' }); continue; }
    if (ch === ':') { advance(); tokens.push({ type: TOKEN.COLON,    value: ':' }); continue; }
    if (ch === '.') { advance(); tokens.push({ type: TOKEN.DOT,      value: '.' }); continue; }
    // Single-char operators
    if ('+-*/%<>='.includes(ch)) {
      advance();
      tokens.push({ type: TOKEN.OP, value: ch, raw: ch });
      continue;
    }
    // Unknown – skip
    advance();
  }
  tokens.push({ type: TOKEN.EOF, value: null });
  return tokens;
}

class ExprParser {
  constructor(tokens, scope, interpreter) {
    this.tokens = tokens;
    this.pos = 0;
    this.scope = scope;           // variable lookup
    this.interpreter = interpreter; // for calling built-in helpers
  }
  peek() { return this.tokens[this.pos]; }
  advance() { return this.tokens[this.pos++]; }
  expect(type) {
    const t = this.advance();
    if (t.type !== type) throw new Error(`Expected ${type} but got ${t.type} (${t.value})`);
    return t;
  }
  /* ── Entry ────────────────────────────────────────────────────────── */
  parse() {
    const val = this.parseExprTuple();
    return val;
  }
  /* ── Tuple / multi-value (a, b, c) at top level ──────────────────── */
  parseExprTuple() {
    const first = this.parseOr();
    if (this.peek().type === TOKEN.COMMA) {
      const items = [first];
      while (this.peek().type === TOKEN.COMMA) {
        this.advance(); // consume comma
        if (this.peek().type === TOKEN.EOF || this.peek().type === TOKEN.RPAREN || this.peek().type === TOKEN.RBRACKET) break;
        items.push(this.parseOr());
      }
      return items; // return as JS array (tuple equivalent)
    }
    return first;
  }
  /* ── or ───────────────────────────────────────────────────────────── */
  parseOr() {
    let left = this.parseAnd();
    while (this.peek().type === TOKEN.KEYWORD && this.peek().value === 'or') {
      this.advance();
      const right = this.parseAnd();
      left = isTruthy(left) ? left : right;
    }
    return left;
  }
  /* ── and ──────────────────────────────────────────────────────────── */
  parseAnd() {
    let left = this.parseNot();
    while (this.peek().type === TOKEN.KEYWORD && this.peek().value === 'and') {
      this.advance();
      const right = this.parseNot();
      left = isTruthy(left) ? right : left;
    }
    return left;
  }
  /* ── not ──────────────────────────────────────────────────────────── */
  parseNot() {
    if (this.peek().type === TOKEN.KEYWORD && this.peek().value === 'not') {
      this.advance();
      const operand = this.parseNot();
      return !isTruthy(operand);
    }
    return this.parseComparison();
  }
  /* ── comparisons ──────────────────────────────────────────────────── */
  parseComparison() {
    let left = this.parseAddSub();
    const compOps = ['==', '!=', '<', '>', '<=', '>='];
    while (true) {
      const t = this.peek();
      if (t.type === TOKEN.OP && compOps.includes(t.value)) {
        const op = this.advance().value;
        const right = this.parseAddSub();
        left = this.applyComparison(left, op, right);
      } else if (t.type === TOKEN.KEYWORD && t.value === 'in') {
        this.advance();
        const right = this.parseAddSub();
        left = this.applyIn(left, right);
      } else if (
        t.type === TOKEN.KEYWORD && t.value === 'not' &&
        this.tokens[this.pos + 1] &&
        this.tokens[this.pos + 1].type === TOKEN.KEYWORD &&
        this.tokens[this.pos + 1].value === 'in'
      ) {
        this.advance(); // not
        this.advance(); // in
        const right = this.parseAddSub();
        left = !this.applyIn(left, right);
      } else {
        break;
      }
    }
    return left;
  }
  applyComparison(l, op, r) {
    switch (op) {
      case '==': return l === r || (typeof l === 'object' && typeof r === 'object' && JSON.stringify(l) === JSON.stringify(r));
      case '!=': return l !== r && !(typeof l === 'object' && typeof r === 'object' && JSON.stringify(l) === JSON.stringify(r));
      case '<':  return l < r;
      case '>':  return l > r;
      case '<=': return l <= r;
      case '>=': return l >= r;
      default:   return false;
    }
  }
  applyIn(needle, haystack) {
    if (typeof haystack === 'string') return haystack.includes(needle);
    if (Array.isArray(haystack)) return haystack.includes(needle);
    if (haystack && typeof haystack === 'object') return needle in haystack;
    throw new Error(`'in' requires string, list, or dict`);
  }
  /* ── addition / subtraction ───────────────────────────────────────── */
  parseAddSub() {
    let left = this.parseMulDivMod();
    while (this.peek().type === TOKEN.OP && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.advance().value;
      const right = this.parseMulDivMod();
      if (op === '+') {
        if (typeof left === 'string' || typeof right === 'string') {
          left = String(left) + String(right);
        } else if (Array.isArray(left) && Array.isArray(right)) {
          left = [...left, ...right];
        } else {
          left = left + right;
        }
      } else {
        left = left - right;
      }
    }
    return left;
  }
  /* ── multiplication / division / modulo ───────────────────────────── */
  parseMulDivMod() {
    let left = this.parsePower();
    while (this.peek().type === TOKEN.OP && ['*', '/', '//', '%'].includes(this.peek().value)) {
      const op = this.advance().value;
      const right = this.parsePower();
      if (op === '*') {
        if (typeof left === 'string' && typeof right === 'number') left = left.repeat(right);
        else if (typeof right === 'string' && typeof left === 'number') left = right.repeat(left);
        else if (Array.isArray(left) && typeof right === 'number') {
          const arr = [];
          for (let r = 0; r < right; r++) arr.push(...left);
          left = arr;
        } else left = left * right;
      } else if (op === '/') {
        if (right === 0) throw new Error('ZeroDivisionError: division by zero');
        left = left / right;
      } else if (op === '//') {
        if (right === 0) throw new Error('ZeroDivisionError: integer division by zero');
        left = Math.floor(left / right);
      } else if (op === '%') {
        if (right === 0) throw new Error('ZeroDivisionError: modulo by zero');
        left = ((left % right) + right) % right; // Python-style modulo
      }
    }
    return left;
  }
  /* ── exponentiation (**) ──────────────────────────────────────────── */
  parsePower() {
    const base = this.parseUnary();
    if (this.peek().type === TOKEN.OP && this.peek().value === '**') {
      this.advance();
      const exp = this.parsePower(); // right-associative
      return Math.pow(base, exp);
    }
    return base;
  }
  /* ── unary -/+ ────────────────────────────────────────────────────── */
  parseUnary() {
    const t = this.peek();
    if (t.type === TOKEN.OP && (t.value === '-' || t.value === '+')) {
      const op = this.advance().value;
      const operand = this.parseUnary();
      return op === '-' ? -operand : +operand;
    }
    return this.parsePostfix();
  }
  /* ── postfix: calls, indexing, dot access ─────────────────────────── */
  parsePostfix() {
    let value = this.parseAtom();
    while (true) {
      const t = this.peek();
      // Function / method call  value(...)
      if (t.type === TOKEN.LPAREN) {
        this.advance();
        const args = [];
        while (this.peek().type !== TOKEN.RPAREN && this.peek().type !== TOKEN.EOF) {
          args.push(this.parseOr()); // parse each arg (not tuple)
          if (this.peek().type === TOKEN.COMMA) this.advance();
        }
        this.expect(TOKEN.RPAREN);
        value = this.applyCall(value, args);
        continue;
      }
      // Indexing / slicing  value[...]
      if (t.type === TOKEN.LBRACKET) {
        this.advance();
        // Check for slicing
        const sliceResult = this.parseSliceArgs();
        this.expect(TOKEN.RBRACKET);
        value = this.applyIndex(value, sliceResult);
        continue;
      }
      // Dot access  value.attr
      if (t.type === TOKEN.DOT) {
        this.advance();
        const attr = this.expect(TOKEN.IDENT);
        // Could be method call (next token is LPAREN) or property access
        if (this.peek().type === TOKEN.LPAREN) {
          this.advance(); // consume (
          const args = [];
          while (this.peek().type !== TOKEN.RPAREN && this.peek().type !== TOKEN.EOF) {
            args.push(this.parseOr());
            if (this.peek().type === TOKEN.COMMA) this.advance();
          }
          this.expect(TOKEN.RPAREN);
          value = this.applyMethod(value, attr.value, args);
        } else {
          value = this.applyDotAccess(value, attr.value);
        }
        continue;
      }

      break;
    }
    return value;
  }
  /* ── Slice argument parsing ───────────────────────────────────────── */
  parseSliceArgs() {
    // Possible forms: [i], [a:b], [a:], [:b], [a:b:step], [:]
    let start = null, stop = null, step = null;
    let isSlice = false;
    if (this.peek().type === TOKEN.COLON) {
      // [:...
      isSlice = true;
      this.advance();
      if (this.peek().type !== TOKEN.RBRACKET && this.peek().type !== TOKEN.COLON) {
        stop = this.parseOr();
      }
      if (this.peek().type === TOKEN.COLON) {
        this.advance();
        if (this.peek().type !== TOKEN.RBRACKET) step = this.parseOr();
      }
    } else {
      start = this.parseOr();
      if (this.peek().type === TOKEN.COLON) {
        isSlice = true;
        this.advance();
        if (this.peek().type !== TOKEN.RBRACKET && this.peek().type !== TOKEN.COLON) {
          stop = this.parseOr();
        }
        if (this.peek().type === TOKEN.COLON) {
          this.advance();
          if (this.peek().type !== TOKEN.RBRACKET) step = this.parseOr();
        }
      }
    }
    if (isSlice) return { isSlice: true, start, stop, step };
    return { isSlice: false, index: start };
  }
  /* ── Atom: literals, identifiers, parenthesised exprs, list/dict ── */
  parseAtom() {
    const t = this.peek();
    // Number
    if (t.type === TOKEN.NUMBER) {
      this.advance();
      return t.value;
    }
    // String (including f-strings)
    if (t.type === TOKEN.STRING) {
      this.advance();
      if (t.isFString) return this.interpolateFString(t.value);
      return t.value;
    }
    // Keywords: True, False, None
    if (t.type === TOKEN.KEYWORD && (t.value === true || t.value === false || t.value === null)) {
      this.advance();
      return t.value;
    }

    // Identifier
    if (t.type === TOKEN.IDENT) {
      this.advance();
      const name = t.value;
      // It might be a built-in function name – return a callable reference
      if (BUILTIN_FUNC_NAMES.has(name)) {
        return { __builtin__: name };
      }
      // Variable lookup
      return this.lookupVar(name);
    }
    // Parenthesised expression (or tuple)
    if (t.type === TOKEN.LPAREN) {
      this.advance();
      if (this.peek().type === TOKEN.RPAREN) {
        this.advance();
        return []; // empty tuple → empty list
      }
      const val = this.parseExprTuple();
      this.expect(TOKEN.RPAREN);
      return val;
    }
    // List literal [...]
    if (t.type === TOKEN.LBRACKET) {
      this.advance();
      const items = [];
      while (this.peek().type !== TOKEN.RBRACKET && this.peek().type !== TOKEN.EOF) {
        items.push(this.parseOr());
        if (this.peek().type === TOKEN.COMMA) this.advance();
      }
      this.expect(TOKEN.RBRACKET);
      return items;
    }
    // Dict literal {...}
    if (t.type === TOKEN.LBRACE) {
      this.advance();
      const dict = {};
      while (this.peek().type !== TOKEN.RBRACE && this.peek().type !== TOKEN.EOF) {
        const key = this.parseOr();
        this.expect(TOKEN.COLON);
        const val = this.parseOr();
        dict[key] = val;
        if (this.peek().type === TOKEN.COMMA) this.advance();
      }
      this.expect(TOKEN.RBRACE);
      return dict;
    }
    throw new Error(`Unexpected token: ${t.type} "${t.value}"`);
  }
  /* ── Variable lookup ──────────────────────────────────────────────── */
  lookupVar(name) {
    for (let i = this.scope.length - 1; i >= 0; i--) {
      if (name in this.scope[i]) return this.scope[i][name];
    }
    throw new Error(`NameError: name '${name}' is not defined`);
  }
  /* ── F-string interpolation ───────────────────────────────────────── */
  interpolateFString(template) {
    let result = '';
    let i = 0;
    while (i < template.length) {
      if (template[i] === '{' && template[i + 1] !== '{') {
        let depth = 1;
        let expr = '';
        i++; // skip {
        while (i < template.length && depth > 0) {
          if (template[i] === '{') depth++;
          else if (template[i] === '}') { depth--; if (depth === 0) break; }
          expr += template[i];
          i++;
        }
        i++; // skip }
        // Evaluate the inner expression
        const tokens = tokenise(expr);
        const parser = new ExprParser(tokens, this.scope, this.interpreter);
        const val = parser.parse();
        result += pyStr(val);
      } else if (template[i] === '{' && template[i + 1] === '{') {
        result += '{';
        i += 2;
      } else if (template[i] === '}' && template[i + 1] === '}') {
        result += '}';
        i += 2;
      } else {
        result += template[i];
        i++;
      }
    }
    return result;
  }
  /* ── Apply call on a value (function object / built-in ref) ──────── */
  applyCall(callee, args) {
    // Built-in function reference
    if (callee && typeof callee === 'object' && callee.__builtin__) {
      return this.interpreter.callBuiltin(callee.__builtin__, args);
    }
    // User-defined function
    if (callee && typeof callee === 'object' && callee.__userFunc__) {
      return this.interpreter.callUserFunction(callee, args);
    }
    // Class instantiation
    if (callee && typeof callee === 'object' && callee.__classDef__) {
      return this.interpreter.instantiateClass(callee, args);
    }
    throw new Error(`TypeError: '${typeof callee}' object is not callable`);
  }
  /* ── Apply index / slice on a value ──────────────────────────────── */
  applyIndex(value, sliceResult) {
    if (sliceResult.isSlice) {
      return this.applySlice(value, sliceResult.start, sliceResult.stop, sliceResult.step);
    }
    const idx = sliceResult.index;
    // String indexing
    if (typeof value === 'string') {
      const i = idx < 0 ? value.length + idx : idx;
      if (i < 0 || i >= value.length) throw new Error('IndexError: string index out of range');
      return value[i];
    }
    // List indexing
    if (Array.isArray(value)) {
      const i = idx < 0 ? value.length + idx : idx;
      if (i < 0 || i >= value.length) throw new Error('IndexError: list index out of range');
      return value[i];
    }
    // Dict access
    if (value && typeof value === 'object') {
      const key = String(idx);
      if (!(key in value) && !(idx in value)) throw new Error(`KeyError: ${JSON.stringify(idx)}`);
      return key in value ? value[key] : value[idx];
    }
    throw new Error(`TypeError: '${typeof value}' object is not subscriptable`);
  }
  applySlice(value, start, stop, step) {
    if (typeof value === 'string') {
      const arr = [...value];
      const sliced = sliceArray(arr, start, stop, step);
      return sliced.join('');
    }
    if (Array.isArray(value)) {
      return sliceArray(value, start, stop, step);
    }
    throw new Error(`TypeError: '${typeof value}' object is not subscriptable`);
  }
  /* ── Apply method on a value ──────────────────────────────────────── */
  applyMethod(obj, method, args) {
    // User class method
    if (obj && typeof obj === 'object' && obj.__userClass__) {
      const classDef = this.interpreter.classes[obj.__userClass__];
      if (classDef && classDef.methods[method]) {
        return this.interpreter.callUserFunction(classDef.methods[method], [obj, ...args]);
      }
      throw new Error(`AttributeError: '${obj.__userClass__}' object has no attribute '${method}'`);
    }

    // ── String methods ────────────────────────────────────────────────
    if (typeof obj === 'string') {
      switch (method) {
        case 'upper':   return obj.toUpperCase();
        case 'lower':   return obj.toLowerCase();
        case 'strip':   return obj.trim();
        case 'lstrip':  return obj.trimStart();
        case 'rstrip':  return obj.trimEnd();
        case 'split': {
          if (args.length === 0) return obj.split(/\s+/).filter(Boolean);
          return obj.split(args[0]);
        }
        case 'join':    return (Array.isArray(args[0]) ? args[0] : []).join(obj);
        case 'replace': return obj.replaceAll(args[0], args[1]);
        case 'find':    return obj.indexOf(args[0]);
        case 'count':   return (obj.match(new RegExp(escapeRegex(args[0]), 'g')) || []).length;
        case 'startswith': return obj.startsWith(args[0]);
        case 'endswith':   return obj.endsWith(args[0]);
        case 'format': {
          let result = obj;
          let idx = 0;
          result = result.replace(/\{\}/g, () => pyStr(args[idx++] !== undefined ? args[idx - 1] : ''));
          result = result.replace(/\{(\d+)\}/g, (_, n) => pyStr(args[parseInt(n)]));
          return result;
        }
        case 'isdigit': return /^\d+$/.test(obj);
        case 'isalpha': return /^[a-zA-Z]+$/.test(obj);
        default: throw new Error(`AttributeError: 'str' object has no attribute '${method}'`);
      }
    }
    // ── List methods ──────────────────────────────────────────────────
    if (Array.isArray(obj)) {
      switch (method) {
        case 'append':  obj.push(args[0]); return null;
        case 'pop':     return args.length > 0 ? obj.splice(args[0], 1)[0] : obj.pop();
        case 'insert':  obj.splice(args[0], 0, args[1]); return null;
        case 'remove': {
          const ix = obj.indexOf(args[0]);
          if (ix === -1) throw new Error(`ValueError: list.remove(x): x not in list`);
          obj.splice(ix, 1);
          return null;
        }
        case 'index': {
          const ix = obj.indexOf(args[0]);
          if (ix === -1) throw new Error(`ValueError: ${pyRepr(args[0])} is not in list`);
          return ix;
        }
        case 'sort': {
          obj.sort((a, b) => {
            if (typeof a === 'number' && typeof b === 'number') return a - b;
            return String(a).localeCompare(String(b));
          });
          return null;
        }
        case 'reverse': { obj.reverse(); return null; }
        case 'extend':  { obj.push(...args[0]); return null; }
        case 'copy':    return [...obj];
        case 'count':   return obj.filter((x) => x === args[0]).length;
        case 'clear':   { obj.length = 0; return null; }
        default: throw new Error(`AttributeError: 'list' object has no attribute '${method}'`);
      }
    }

    // ── Dict methods ──────────────────────────────────────────────────
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && !obj.__builtin__ && !obj.__userFunc__ && !obj.__module__) {
      switch (method) {
        case 'keys':   return Object.keys(obj);
        case 'values': return Object.values(obj);
        case 'items':  return Object.entries(obj).map(([k, v]) => [k, v]);
        case 'get':    return args[0] in obj ? obj[args[0]] : (args.length > 1 ? args[1] : null);
        case 'pop': {
          const key = String(args[0]);
          if (key in obj) { const v = obj[key]; delete obj[key]; return v; }
          if (args.length > 1) return args[1];
          throw new Error(`KeyError: ${JSON.stringify(args[0])}`);
        }
        case 'update': { Object.assign(obj, args[0]); return null; }
        case 'copy':   return { ...obj };
        case 'clear':  { for (const k in obj) delete obj[k]; return null; }
        default: throw new Error(`AttributeError: 'dict' object has no attribute '${method}'`);
      }
    }
    // ── Module attribute access (e.g. math.sqrt called as method) ────
    if (obj && typeof obj === 'object' && obj.__module__) {
      const modFunc = obj[method];
      if (typeof modFunc === 'function') return modFunc(...args);
      throw new Error(`AttributeError: module '${obj.__module__}' has no attribute '${method}'`);
    }
    throw new Error(`AttributeError: object has no attribute '${method}'`);
  }
  /* ── Dot property access (non-call) ───────────────────────────────── */
  applyDotAccess(obj, attr) {
    // Module attribute
    if (obj && typeof obj === 'object' && obj.__module__) {
      if (attr in obj) return obj[attr];
      throw new Error(`AttributeError: module '${obj.__module__}' has no attribute '${attr}'`);
    }
    // Dict-like access (shouldn't normally happen in Python, but support it)
    if (obj && typeof obj === 'object' && attr in obj) return obj[attr];
    throw new Error(`AttributeError: object has no attribute '${attr}'`);
  }
}
/* ── Built-in function name set (for atom detection) ─────────────────── */
const BUILTIN_FUNC_NAMES = new Set([
  'print', 'len', 'range', 'int', 'str', 'float', 'bool',
  'abs', 'min', 'max', 'sum', 'type', 'input', 'round',
  'sorted', 'list', 'dict', 'tuple', 'set', 'enumerate', 'zip', 'map',
  'isinstance', 'ord', 'chr', 'hex', 'bin', 'oct', 'pow',
]);
/* ========================================================================
   §3  UTILITY FUNCTIONS
   ======================================================================== */
function isTruthy(val) {
  if (val === null || val === undefined) return false;
  if (val === false) return false;
  if (val === 0 || val === 0.0) return false;
  if (val === '') return false;
  if (Array.isArray(val) && val.length === 0) return false;
  if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0 && !val.__builtin__ && !val.__userFunc__ && !val.__module__) return false;
  return true;
}
function pyStr(val) {
  if (val === null || val === undefined) return 'None';
  if (val === true) return 'True';
  if (val === false) return 'False';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return '[' + val.map(pyRepr).join(', ') + ']';
  if (typeof val === 'object' && val.__module__) return `<module '${val.__module__}'>`;
  if (typeof val === 'object' && val.__userFunc__) return `<function ${val.__name__}>`;
  if (typeof val === 'object' && val.__builtin__) return `<built-in function ${val.__builtin__}>`;
  if (typeof val === 'object') {
    const entries = Object.entries(val).map(([k, v]) => `${pyRepr(k)}: ${pyRepr(v)}`);
    return '{' + entries.join(', ') + '}';
  }
  return String(val);
}
function pyRepr(val) {
  if (typeof val === 'string') return `'${val}'`;
  return pyStr(val);
}
function pyType(val) {
  if (val === null || val === undefined) return 'NoneType';
  if (typeof val === 'boolean') return 'bool';
  if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'float';
  if (typeof val === 'string') return 'str';
  if (Array.isArray(val)) return 'list';
  if (typeof val === 'object' && val.__module__) return 'module';
  if (typeof val === 'object' && val.__userFunc__) return 'function';
  if (typeof val === 'object' && val.__userClass__) return val.__userClass__;
  if (typeof val === 'object') return 'dict';
  return typeof val;
}
function deepClone(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') return val;
  if (Array.isArray(val)) return val.map(deepClone);
  if (typeof val === 'object') {
    if (val.__builtin__ || val.__userFunc__ || val.__module__) return val; // don't deep-clone callables/modules
    const obj = {};
    for (const key of Object.keys(val)) {
      obj[key] = deepClone(val[key]);
    }
    return obj;
  }
  return val;
}
function sliceArray(arr, start, stop, step) {
  const len = arr.length;
  const s = step !== null && step !== undefined ? step : 1;
  if (s === 0) throw new Error('ValueError: slice step cannot be zero');
  let a, b;
  if (s > 0) {
    a = start !== null && start !== undefined ? (start < 0 ? Math.max(len + start, 0) : Math.min(start, len)) : 0;
    b = stop !== null && stop !== undefined ? (stop < 0 ? Math.max(len + stop, 0) : Math.min(stop, len)) : len;
    const result = [];
    for (let i = a; i < b; i += s) result.push(arr[i]);
    return result;
  } else {
    a = start !== null && start !== undefined ? (start < 0 ? Math.max(len + start, -1) : Math.min(start, len - 1)) : len - 1;
    b = stop !== null && stop !== undefined ? (stop < 0 ? Math.max(len + stop, -1) : Math.min(stop, len - 1)) : -1;
    const result = [];
    for (let i = a; i > b; i += s) result.push(arr[i]);
    return result;
  }
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/* ========================================================================
   §4  MATH MODULE SIMULATION
   ======================================================================== */
function createMathModule() {
  return {
    __module__: 'math',
    pi: Math.PI,
    e: Math.E,
    inf: Infinity,
    sqrt:  (x) => Math.sqrt(x),
    floor: (x) => Math.floor(x),
    ceil:  (x) => Math.ceil(x),
    abs:   (x) => Math.abs(x),
    pow:   (x, y) => Math.pow(x, y),
    log:   (x, base) => base !== undefined ? Math.log(x) / Math.log(base) : Math.log(x),
    log2:  (x) => Math.log2(x),
    log10: (x) => Math.log10(x),
    sin:   (x) => Math.sin(x),
    cos:   (x) => Math.cos(x),
    tan:   (x) => Math.tan(x),
    factorial: (n) => {
      if (n < 0) throw new Error('ValueError: factorial() not defined for negative values');
      let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
    },
    gcd: (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; },
  };
}
function createRandomModule() {
  return {
    __module__: 'random',
    random:    () => Math.random(),
    randint:   (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
    choice:    (seq) => seq[Math.floor(Math.random() * seq.length)],
    shuffle:   (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return null; },
    uniform:   (a, b) => a + Math.random() * (b - a),
  };
}
const MODULE_FACTORY = {
  math: createMathModule,
  random: createRandomModule,
};
/* ========================================================================
   §5  INTERPRETER CLASS
   ======================================================================== */
const MAX_STEPS = 10000;
export class Interpreter {
  constructor() {
    this._reset();
  }

  /* ── Internal reset ───────────────────────────────────────────────── */
  _reset() {
    this.lines = [];           // LineDescriptor[]
    this.rawCode = '';
    this.rawLines = [];
    this.scope = [{}];         // scope stack (index 0 = global)
    this.output = [];          // accumulated stdout
    this.imports = [];         // imported module names
    this.snapshots = [];       // ExecutionSnapshot[]
    this.pc = 0;               // program counter (index into this.lines)
    this.stepCount = 0;
    this.finished = false;
    this.error = null;
    // Loop stack: { type: 'for'|'while', startPC, endPC, iterator?, iterIdx?, varName? }
    this.loopStack = [];
    // Call stack: { returnPC, scopeIndex, loopStackLen }
    this.callStack = [];
    // Input handling
    this._waitingForInput = false;
    this._inputResolve = null;
    this._inputValue = null;
    // Functions defined by user code
    this.functions = {};       // name → { params, defaults, bodyStart, bodyEnd }
    // Classes defined by user code
    this.classes = {};         // name → { name, methods, bodyStart, bodyEnd }
  }
  /* ── Public API ───────────────────────────────────────────────────── */
  load(rawCode) {
    this._reset();
    this.rawCode = rawCode;
    this.rawLines = rawCode.split('\n');
    this.lines = parseCode(rawCode);
    // Pre-scan for function definitions to know their body ranges
    this._prescanFunctions();
    this._prescanClasses();
  }
  step() {
    if (this.stepCount < this.snapshots.length - 1) {
      this.stepCount++;
      const next = this.snapshots[this.stepCount];
      this._restoreFromSnapshot(next);
      return next;
    }
    if (this.finished) return this._lastSnapshot();
    if (this._waitingForInput) return this._lastSnapshot();
    if (this.stepCount >= MAX_STEPS) {
      this.finished = true;
      return this._makeSnapshot('Step limit exceeded (10 000 steps)', true);
    }
    try {
      return this._executeStep();
    } catch (err) {
      this.finished = true;
      return this._makeSnapshot(err.message, true);
    }
  }
  canStepForward() {
    return (this.stepCount < this.snapshots.length - 1) || (!this.finished && !this._waitingForInput);
  }
  canStepBack() {
    return this.stepCount > 0;
  }
  stepBack() {
    if (this.stepCount <= 0) return this.snapshots[0] || null;
    this.stepCount--;
    const prev = this.snapshots[this.stepCount];
    // Restore interpreter state from snapshot
    this._restoreFromSnapshot(prev);
    return prev;
  }
  getSnapshot(index) {
    if (index < 0 || index >= this.snapshots.length) return null;
    return this.snapshots[index];
  }
  getCurrentStep() {
    return this.stepCount;
  }
  reset() {
    const code = this.rawCode;
    this._reset();
    if (code) this.load(code);
  }
  isFinished() {
    return this.finished;
  }
  provideInput(value) {
    if (!this._waitingForInput) return;
    this._inputValue = value;
    this._waitingForInput = false;
  }
  needsInput() {
    return this._waitingForInput;
  }
  /* ── Pre-scan: find function bodies ───────────────────────────────── */
  _prescanFunctions() {
    for (let i = 0; i < this.lines.length; i++) {
      const ld = this.lines[i];
      if (ld.type === 'FUNC_DEF') {
        const defIndent = ld.indent;
        const match = ld.raw.trim().match(/^def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*:/);
        if (!match) continue;
        const name = match[1];
        const rawParams = match[2];
        const { params, defaults } = this._parseParams(rawParams);
        // Body = lines after def until indent drops back to defIndent or below
        let bodyEnd = i;
        for (let j = i + 1; j < this.lines.length; j++) {
          const line = this.lines[j];
          if (line.type === 'BLANK' || line.type === 'COMMENT') { bodyEnd = j; continue; }
          if (line.indent > defIndent) { bodyEnd = j; } else { break; }
        }
        this.functions[name] = { params, defaults, bodyStart: i + 1, bodyEnd, defIndent };
      }
    }
  }
  _prescanClasses() {
    for (let i = 0; i < this.lines.length; i++) {
      const ld = this.lines[i];
      if (ld.type === 'CLASS_DEF') {
        const classIndent = ld.indent;
        const match = ld.raw.trim().match(/^class\s+([a-zA-Z_]\w*)/);
        if (!match) continue;
        const className = match[1];
        
        let bodyEnd = i;
        for (let j = i + 1; j < this.lines.length; j++) {
          const line = this.lines[j];
          if (line.type === 'BLANK' || line.type === 'COMMENT') { bodyEnd = j; continue; }
          if (line.indent > classIndent) { bodyEnd = j; } else { break; }
        }

        const methods = {};
        for (let j = i + 1; j <= bodyEnd; j++) {
          const line = this.lines[j];
          if (line.type === 'FUNC_DEF' && line.indent === classIndent + 1) {
            const fMatch = line.raw.trim().match(/^def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*:/);
            if (fMatch) {
              const methodName = fMatch[1];
              const rawParams = fMatch[2];
              const { params, defaults } = this._parseParams(rawParams);
              let mBodyEnd = j;
              for (let k = j + 1; k <= bodyEnd; k++) {
                const mLine = this.lines[k];
                if (mLine.type === 'BLANK' || mLine.type === 'COMMENT') { mBodyEnd = k; continue; }
                if (mLine.indent > line.indent) { mBodyEnd = k; } else { break; }
              }
              methods[methodName] = {
                __name__: methodName,
                params,
                defaults,
                bodyStart: j + 1,
                bodyEnd: mBodyEnd,
                defIndent: line.indent
              };
            }
          }
        }

        this.classes[className] = {
          __classDef__: true,
          name: className,
          methods,
          bodyStart: i + 1,
          bodyEnd
        };
      }
    }
  }
  _parseParams(rawParams) {
    const params = [];
    const defaults = {};
    if (!rawParams.trim()) return { params, defaults };
    const parts = rawParams.split(',');
    for (const p of parts) {
      const trimmed = p.trim();
      if (trimmed.includes('=')) {
        const [pName, pDefault] = trimmed.split('=').map((s) => s.trim());
        params.push(pName);
        defaults[pName] = pDefault; // stored as string, evaluated at call time
      } else {
        params.push(trimmed);
      }
    }
    return { params, defaults };
  }
  /* ── Core execution step ──────────────────────────────────────────── */
  _executeStep() {
    // Skip blank lines, comments, and function defs (already pre-scanned)
    while (this.pc < this.lines.length) {
      const ld = this.lines[this.pc];
      if (ld.type === 'BLANK' || ld.type === 'COMMENT') { this.pc++; continue; }
      // Skip function bodies unless we're executing inside a function call
      if (ld.type === 'FUNC_DEF' && this.callStack.length === 0) {
        // Skip the entire body
        const funcInfo = this.functions[ld.targets[0]];
        if (funcInfo) {
          // Register the function in scope
          this.scope[this.scope.length - 1][ld.targets[0]] = {
            __userFunc__: true,
            __name__: ld.targets[0],
            ...funcInfo,
          };
          const snap = this._makeSnapshot(null, false, ld);
          this.pc = funcInfo.bodyEnd + 1;
          this.stepCount++;
          this.snapshots.push(snap);
          return snap;
        }
      }
      break;
    }
    if (this.pc >= this.lines.length) {
      this.finished = true;
      return this._makeSnapshot(null, true);
    }
    const ld = this.lines[this.pc];
    let snap;
    switch (ld.type) {
      case 'IMPORT':        snap = this._execImport(ld); break;
      case 'ASSIGN_LITERAL':snap = this._execAssign(ld); break;
      case 'ASSIGN_CALC':   snap = this._execAssign(ld); break;
      case 'ASSIGN_CALL':   snap = this._execAssign(ld); break;
      case 'INPUT':         snap = this._execInput(ld); break;
      case 'PRINT':         snap = this._execPrint(ld); break;
      case 'CONDITIONAL':   snap = this._execConditional(ld); break;
      case 'ELIF':          snap = this._execConditional(ld); break;
      case 'ELSE':          snap = this._execElse(ld); break;
      case 'LOOP_FOR':      snap = this._execFor(ld); break;
      case 'LOOP_WHILE':    snap = this._execWhile(ld); break;
      case 'FUNC_DEF':      snap = this._execFuncDef(ld); break;
      case 'CLASS_DEF':     snap = this._execClassDef(ld); break;
      case 'RETURN':        snap = this._execReturn(ld); break;
      case 'EXPRESSION':    snap = this._execExpression(ld); break;
      default:
        snap = this._makeSnapshot(null, false, ld);
        this.pc++;
        break;
    }
    this.stepCount++;
    this.snapshots.push(snap);
    if (this._waitingForInput) return snap;
    // Check if we've finished
    if (this.pc >= this.lines.length && this.callStack.length === 0) {
      this.finished = true;
      snap.isComplete = true;
    }
    return snap;
  }
  /* ── Execution handlers ───────────────────────────────────────────── */
  _execImport(ld) {
    this._execImportInline(ld);
    const snap = this._makeSnapshot(null, false, ld);
    this.pc++;
    return snap;
  }
  _execImportInline(ld) {
    const trimmed = ld.raw.trim();
    if (trimmed.startsWith('from')) {
      const m = trimmed.match(/^from\s+(\S+)\s+import\s+(.+)/);
      if (m) {
        const modName = m[1];
        const names = m[2].split(',').map((s) => s.trim());
        if (!this.imports.includes(modName)) this.imports.push(modName);
        const factory = MODULE_FACTORY[modName];
        if (factory) {
          const mod = factory();
          const topScope = this.scope[this.scope.length - 1];
          for (const name of names) {
            if (name in mod) topScope[name] = mod[name];
          }
        }
      }
    } else {
      const m = trimmed.match(/^import\s+(.+)/);
      if (m) {
        const modules = m[1].split(',').map((s) => s.trim());
        for (const modName of modules) {
          if (!this.imports.includes(modName)) this.imports.push(modName);
          const factory = MODULE_FACTORY[modName];
          if (factory) {
            this.scope[this.scope.length - 1][modName] = factory();
          }
        }
      }
    }
  }
  _execAssign(ld) {
    const trimmed = ld.raw.trim();
    const topScope = this.scope[this.scope.length - 1];
    let changedVars = [];
    // Detect augmented assignment
    const augOps = ['**=', '//=', '+=', '-=', '*=', '/=', '%='];
    let augOp = null;
    let augIdx = -1;
    for (const op of augOps) {
      const idx = this._findAugAssignment(trimmed, op);
      if (idx !== -1) {
        augOp = op;
        augIdx = idx;
        break;
      }
    }
    if (augOp !== null) {
      const lhs = trimmed.slice(0, augIdx).trim();
      const rhsStr = trimmed.slice(augIdx + augOp.length).trim();
      const rhsVal = this._evalExpr(rhsStr);
      const baseOp = augOp.slice(0, -1);
      // Handle subscript assignment: a[i] += val
      if (lhs.includes('[')) {
        const baseExpr = lhs.slice(0, lhs.indexOf('['));
        const idxExpr = lhs.slice(lhs.indexOf('[') + 1, lhs.lastIndexOf(']'));
        const baseObj = this._evalExpr(baseExpr);
        const idx = this._evalExpr(idxExpr);
        const oldVal = Array.isArray(baseObj) ? baseObj[idx < 0 ? baseObj.length + idx : idx] : baseObj[idx];
        const newVal = this._applyOp(oldVal, baseOp, rhsVal);
        if (Array.isArray(baseObj)) {
          baseObj[idx < 0 ? baseObj.length + idx : idx] = newVal;
        } else {
          baseObj[idx] = newVal;
        }
        changedVars = [baseExpr];
      } else {
        const currentVal = this._evalExpr(lhs);
        const newVal = this._applyOp(currentVal, baseOp, rhsVal);
        this._setVar(lhs, newVal);
        changedVars = [lhs];
      }
    } else {
      // Regular = assignment
      const eqIdx = this._findAssignEquals(trimmed);
      if (eqIdx === -1) {
        const snap = this._makeSnapshot('SyntaxError: invalid assignment', false, ld);
        this.pc++;
        return snap;
      }
      const lhs = trimmed.slice(0, eqIdx).trim();
      const rhsStr = trimmed.slice(eqIdx + 1).trim();
      // Multi-target: a, b = expr
      const lhsParts = this._splitTopLevel(lhs, ',');
      if (lhsParts.length > 1) {
        const rhsVal = this._evalExpr(rhsStr);
        // Evaluate RHS first (important for swaps)
        let values;
        if (Array.isArray(rhsVal)) {
          values = rhsVal;
        } else {
          // Try parsing as tuple on RHS
          const rhsParts = this._splitTopLevel(rhsStr, ',');
          if (rhsParts.length > 1) {
            values = rhsParts.map((p) => this._evalExpr(p.trim()));
          } else {
            values = [rhsVal];
          }
        }
        for (let i = 0; i < lhsParts.length; i++) {
          const target = lhsParts[i].trim();
          const val = i < values.length ? values[i] : null;
          this._assignTarget(target, val);
          changedVars.push(target.match(/^([a-zA-Z_]\w*)/)?.[1] || target);
        }
      } else {
        // Single target
        const target = lhs.trim();
        const rhsVal = this._evalExpr(rhsStr);
        this._assignTarget(target, rhsVal);
        changedVars = [target.split(/\[|\./)[0]];
      }
    }
    const snap = this._makeSnapshot(null, false, ld, changedVars);
    this.pc++;
    return snap;
  }
  _execInput(ld) {
    const trimmed = ld.raw.trim();
    const eqIdx = this._findAssignEquals(trimmed);
    const lhs = trimmed.slice(0, eqIdx).trim();
    const rhsStr = trimmed.slice(eqIdx + 1).trim();
    // Extract prompt from input("...")
    const promptMatch = rhsStr.match(/input\s*\(([^)]*)\)/);
    let prompt = '';
    if (promptMatch && promptMatch[1]) {
      prompt = this._evalExpr(promptMatch[1].trim());
    }
    // Check if there's a wrapping conversion like int(input("..."))
    const convMatch = rhsStr.match(/^(int|float|str|bool)\s*\(\s*input/);
    if (this._inputValue !== null) {
      // We have input ready
      let value = this._inputValue;
      this._inputValue = null;
      if (convMatch) {
        const convFunc = convMatch[1];
        value = this.callBuiltin(convFunc, [value]);
      }
      this._setVar(lhs, value);
      const snap = this._makeSnapshot(null, false, ld, [lhs]);
      this.pc++;
      return snap;
    }
    // Need to wait for input
    this._waitingForInput = true;
    const snap = this._makeSnapshot(null, false, ld);
    snap.cpuAction = `Waiting for input: ${prompt || '(no prompt)'}`;
    snap.waitingForInput = true;
    snap.inputPrompt = typeof prompt === 'string' ? prompt : '';
    return snap;
  }
  _execPrint(ld) {
    const trimmed = ld.raw.trim();
    const innerMatch = trimmed.match(/^print\s*\(([\s\S]*)\)\s*$/);
    let newOutput = '';
    if (innerMatch) {
      const inner = innerMatch[1].trim();
      if (inner === '') {
        newOutput = '';
      } else {
        // Parse the arguments to print, handling sep and end kwargs
        const args = this._splitPrintArgs(inner);
        let sep = ' ';
        let end = '\n';
        const posArgs = [];
        for (const arg of args) {
          const trimArg = arg.trim();
          if (trimArg.startsWith('sep=')) {
            sep = this._evalExpr(trimArg.slice(4).trim());
          } else if (trimArg.startsWith('end=')) {
            end = this._evalExpr(trimArg.slice(4).trim());
          } else {
            posArgs.push(this._evalExpr(trimArg));
          }
        }
        newOutput = posArgs.map(pyStr).join(sep);
      }
    }
    this.output.push(newOutput);
    const snap = this._makeSnapshot(null, false, ld);
    snap.newOutput = newOutput;
    this.pc++;
    return snap;
  }
  _splitPrintArgs(inner) {
    // Split print arguments at top-level commas
    return this._splitTopLevel(inner, ',');
  }
  _execConditional(ld) {
    const trimmed = ld.raw.trim();
    let condStr;
    if (trimmed.startsWith('elif')) {
      condStr = trimmed.slice(5, -1).trim();
    } else {
      condStr = trimmed.slice(3, -1).trim();
    }
    const condVal = this._evalExpr(condStr);
    const snap = this._makeSnapshot(null, false, ld);
    if (isTruthy(condVal)) {
      // Enter the block
      this.pc++;
    } else {
      // Skip to matching elif/else/end of block
      this._skipToNextBranch(ld.indent);
    }
    return snap;
  }
  _execElse(ld) {
    // If we reach an else by normal flow, we enter it
    const snap = this._makeSnapshot(null, false, ld);
    this.pc++;
    return snap;
  }
  _execFor(ld) {
    const trimmed = ld.raw.trim();
    const match = trimmed.match(/^for\s+(.+?)\s+in\s+(.+):\s*$/);
    if (!match) {
      const snap = this._makeSnapshot('SyntaxError: invalid for loop', false, ld);
      this.pc++;
      return snap;
    }
    const varExpr = match[1].trim();
    const iterExpr = match[2].trim();
    // Check if this loop is already on the loop stack (re-entry)
    const existingLoop = this.loopStack.length > 0 ? this.loopStack[this.loopStack.length - 1] : null;
    if (existingLoop && existingLoop.type === 'for' && existingLoop.startPC === this.pc) {
      // Continue iteration
      existingLoop.iterIdx++;
      if (existingLoop.iterIdx < existingLoop.iterator.length) {
        const val = existingLoop.iterator[existingLoop.iterIdx];
        this._assignIterVar(varExpr, val);
        const snap = this._makeSnapshot(null, false, ld, this._extractVarNames(varExpr));
        this.pc++;
        return snap;
      } else {
        // Loop finished
        this.loopStack.pop();
        this._skipBlock(ld.indent);
        const snap = this._makeSnapshot(null, false, ld);
        return snap;
      }
    }
    // First entry into loop
    const iterVal = this._evalExpr(iterExpr);
    let iterator;
    if (Array.isArray(iterVal)) {
      iterator = iterVal;
    } else if (typeof iterVal === 'string') {
      iterator = [...iterVal];
    } else if (typeof iterVal === 'object' && iterVal !== null) {
      iterator = Object.keys(iterVal);
    } else {
      throw new Error(`TypeError: '${pyType(iterVal)}' object is not iterable`);
    }
    // Find end of loop body
    const bodyEnd = this._findBlockEnd(this.pc, ld.indent);
    if (iterator.length === 0) {
      // Empty iterator, skip loop body
      this._skipBlock(ld.indent);
      const snap = this._makeSnapshot(null, false, ld);
      return snap;
    }
    this.loopStack.push({
      type: 'for',
      startPC: this.pc,
      endPC: bodyEnd,
      iterator,
      iterIdx: 0,
      varExpr,
    });
    const val = iterator[0];
    this._assignIterVar(varExpr, val);
    const snap = this._makeSnapshot(null, false, ld, this._extractVarNames(varExpr));
    this.pc++;
    return snap;
  }
  _assignIterVar(varExpr, val) {
    // Handle tuple unpacking: for a, b in list_of_tuples
    const parts = varExpr.split(',').map((s) => s.trim());
    if (parts.length > 1 && Array.isArray(val)) {
      for (let i = 0; i < parts.length; i++) {
        this._setVar(parts[i], i < val.length ? val[i] : null);
      }
    } else {
      this._setVar(varExpr, val);
    }
  }
  _extractVarNames(varExpr) {
    return varExpr.split(',').map((s) => s.trim());
  }
  _execWhile(ld) {
    const trimmed = ld.raw.trim();
    const condStr = trimmed.slice(6, -1).trim();
    const existingLoop = this.loopStack.length > 0 ? this.loopStack[this.loopStack.length - 1] : null;
    if (existingLoop && existingLoop.type === 'while' && existingLoop.startPC === this.pc) {
      // Re-check condition
      const condVal = this._evalExpr(condStr);
      const snap = this._makeSnapshot(null, false, ld);
      if (isTruthy(condVal)) {
        this.pc++;
      } else {
        this.loopStack.pop();
        this._skipBlock(ld.indent);
      }
      return snap;
    }
    // First entry
    const condVal = this._evalExpr(condStr);
    const snap = this._makeSnapshot(null, false, ld);
    if (isTruthy(condVal)) {
      const bodyEnd = this._findBlockEnd(this.pc, ld.indent);
      this.loopStack.push({
        type: 'while',
        startPC: this.pc,
        endPC: bodyEnd,
      });
      this.pc++;
    } else {
      this._skipBlock(ld.indent);
    }
    return snap;
  }
  _execFuncDef(ld) {
    // Inside a function call – we should have hit this only if executing in call context
    const name = ld.targets[0];
    const funcInfo = this.functions[name];
    if (funcInfo) {
      this.scope[this.scope.length - 1][name] = {
        __userFunc__: true,
        __name__: name,
        ...funcInfo,
      };
    }
    const snap = this._makeSnapshot(null, false, ld);
    if (funcInfo) {
      this.pc = funcInfo.bodyEnd + 1;
    } else {
      this.pc++;
    }
    return snap;
  }
  _execClassDef(ld) {
    const name = ld.targets[0];
    const classDef = this.classes[name];
    if (classDef) {
      this.scope[this.scope.length - 1][name] = classDef;
    }
    const snap = this._makeSnapshot(null, false, ld);
    if (classDef) {
      this.pc = classDef.bodyEnd + 1;
    } else {
      this.pc++;
    }
    return snap;
  }
  _execReturn(ld) {
    const trimmed = ld.raw.trim();
    const retExpr = trimmed.slice(6).trim();
    let retVal = null;
    if (retExpr) {
      retVal = this._evalExpr(retExpr);
    }
    const snap = this._makeSnapshot(null, false, ld);
    // Pop call stack
    if (this.callStack.length > 0) {
      const frame = this.callStack.pop();
      this.pc = frame.returnPC;
      // Pop scope
      while (this.scope.length > frame.scopeIndex) this.scope.pop();
      // Restore loop stack
      while (this.loopStack.length > frame.loopStackLen) this.loopStack.pop();
      // Store return value for the caller to pick up
      this._lastReturnValue = retVal;
    } else {
      this.finished = true;
      snap.isComplete = true;
    }
    return snap;
  }
  _execExpression(ld) {
    const trimmed = ld.raw.trim();
    // Handle break
    if (trimmed === 'break') {
      const snap = this._makeSnapshot(null, false, ld);
      if (this.loopStack.length > 0) {
        const loop = this.loopStack.pop();
        this._skipBlock(this.lines[loop.startPC].indent);
      } else {
        this.pc++;
      }
      return snap;
    }
    // Handle continue
    if (trimmed === 'continue') {
      const snap = this._makeSnapshot(null, false, ld);
      if (this.loopStack.length > 0) {
        const loop = this.loopStack[this.loopStack.length - 1];
        this.pc = loop.startPC;
      } else {
        this.pc++;
      }
      return snap;
    }
    // Handle pass
    if (trimmed === 'pass') {
      const snap = this._makeSnapshot(null, false, ld);
      this.pc++;
      return snap;
    }
    // Handle del
    if (trimmed.startsWith('del ')) {
      const target = trimmed.slice(4).trim();
      const topScope = this.scope[this.scope.length - 1];
      if (target in topScope) delete topScope[target];
      const snap = this._makeSnapshot(null, false, ld);
      this.pc++;
      return snap;
    }
    // General expression (method calls, etc.)
    this._evalExpr(trimmed);
    const snap = this._makeSnapshot(null, false, ld);
    this.pc++;
    return snap;
  }
  /* ── Block navigation ─────────────────────────────────────────────── */
  /**
   * Find the PC of the first line after the block at `blockIndent` starting from `startPC`.
   */
  _findBlockEnd(startPC, blockIndent) {
    for (let i = startPC + 1; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (line.type === 'BLANK' || line.type === 'COMMENT') continue;
      if (line.indent <= blockIndent) return i - 1;
    }
    return this.lines.length - 1;
  }
  /**
   * Skip past the current block (used when loop/condition is false).
   */
  _skipBlock(blockIndent) {
    this.pc++;
    while (this.pc < this.lines.length) {
      const line = this.lines[this.pc];
      if (line.type === 'BLANK' || line.type === 'COMMENT') { this.pc++; continue; }
      if (line.indent <= blockIndent) break;
      this.pc++;
    }
  }
  /**
   * After a false if/elif condition, skip to the next elif/else at the same indent, or end of block.
   */
  _skipToNextBranch(blockIndent) {
    this.pc++;
    while (this.pc < this.lines.length) {
      const line = this.lines[this.pc];
      if (line.type === 'BLANK' || line.type === 'COMMENT') { this.pc++; continue; }
      if (line.indent < blockIndent) break;
      if (line.indent === blockIndent) {
        if (line.type === 'ELIF' || line.type === 'ELSE') break;
        if (line.indent <= blockIndent && line.type !== 'ELIF' && line.type !== 'ELSE') break;
      }
      this.pc++;
    }
  }
  /* ── End-of-block detection (for loop bodies) ─────────────────────── */
  /**
   * Called when we finish a line inside a block.  Checks if next line leaves the block,
   * triggering loop-back or branch-skip behaviour.
   */
  _checkBlockEnd() {
    if (this.pc >= this.lines.length) return;
    const currentLine = this.lines[this.pc];
    // Skip blanks/comments to peek at next meaningful line
    let peekPC = this.pc;
    while (peekPC < this.lines.length && (this.lines[peekPC].type === 'BLANK' || this.lines[peekPC].type === 'COMMENT')) {
      peekPC++;
    }
    if (peekPC >= this.lines.length) return;
    const nextLine = this.lines[peekPC];
    // Check loop stack
    if (this.loopStack.length > 0) {
      const loop = this.loopStack[this.loopStack.length - 1];
      const loopIndent = this.lines[loop.startPC].indent;
      if (nextLine.indent <= loopIndent && nextLine.type !== 'ELIF' && nextLine.type !== 'ELSE') {
        // We've exited the loop body — jump back to loop header
        this.pc = loop.startPC;
        return;
      }
    }
  }
  /* ── Expression evaluation entry point ────────────────────────────── */
  _evalExpr(exprStr) {
    const tokens = tokenise(exprStr);
    const parser = new ExprParser(tokens, this.scope, this);
    return parser.parse();
  }
  /* ── Variable set/get helpers ─────────────────────────────────────── */
  _setVar(name, value) {
    // Set in the top-most scope
    this.scope[this.scope.length - 1][name] = value;
  }
  _getVar(name) {
    for (let i = this.scope.length - 1; i >= 0; i--) {
      if (name in this.scope[i]) return this.scope[i][name];
    }
    throw new Error(`NameError: name '${name}' is not defined`);
  }
  /* ── Built-in function dispatch ───────────────────────────────────── */
  callBuiltin(name, args) {
    switch (name) {
      case 'print': {
        const out = args.map(pyStr).join(' ');
        this.output.push(out);
        return null;
      }
      case 'len': {
        const val = args[0];
        if (typeof val === 'string') return val.length;
        if (Array.isArray(val)) return val.length;
        if (val && typeof val === 'object') return Object.keys(val).length;
        throw new Error(`TypeError: object of type '${pyType(val)}' has no len()`);
      }
      case 'range': {
        let start = 0, stop, step = 1;
        if (args.length === 1) { stop = args[0]; }
        else if (args.length === 2) { start = args[0]; stop = args[1]; }
        else { start = args[0]; stop = args[1]; step = args[2]; }
        if (step === 0) throw new Error('ValueError: range() arg 3 must not be zero');
        const result = [];
        if (step > 0) { for (let i = start; i < stop; i += step) result.push(i); }
        else { for (let i = start; i > stop; i += step) result.push(i); }
        return result;
      }
      case 'int': {
        if (args.length === 0) return 0;
        const v = args[0];
        if (typeof v === 'boolean') return v ? 1 : 0;
        if (typeof v === 'number') return Math.trunc(v);
        if (typeof v === 'string') {
          const parsed = parseInt(v, args.length > 1 ? args[1] : 10);
          if (isNaN(parsed)) throw new Error(`ValueError: invalid literal for int() with base 10: '${v}'`);
          return parsed;
        }
        throw new Error(`TypeError: int() argument must be a string or a number`);
      }
      case 'float': {
        if (args.length === 0) return 0.0;
        const v = args[0];
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          const parsed = parseFloat(v);
          if (isNaN(parsed)) throw new Error(`ValueError: could not convert string to float: '${v}'`);
          return parsed;
        }
        if (typeof v === 'boolean') return v ? 1.0 : 0.0;
        throw new Error(`TypeError: float() argument must be a string or a number`);
      }
      case 'str': {
        if (args.length === 0) return '';
        return pyStr(args[0]);
      }
      case 'bool': {
        if (args.length === 0) return false;
        return isTruthy(args[0]);
      }
      case 'abs':   return Math.abs(args[0]);
      case 'round': {
        if (args.length === 1) return Math.round(args[0]);
        const factor = Math.pow(10, args[1]);
        return Math.round(args[0] * factor) / factor;
      }
      case 'min': {
        if (args.length === 1 && Array.isArray(args[0])) return Math.min(...args[0]);
        return Math.min(...args);
      }
      case 'max': {
        if (args.length === 1 && Array.isArray(args[0])) return Math.max(...args[0]);
        return Math.max(...args);
      }
      case 'sum': {
        const arr = Array.isArray(args[0]) ? args[0] : args;
        const start = args.length > 1 ? args[1] : 0;
        return arr.reduce((a, b) => a + b, start);
      }
      case 'type': {
        return `<class '${pyType(args[0])}'>`;
      }
      case 'input': {
        // This shouldn't normally be called here – handled by _execInput.
        // But if print(input("x")) is used:
        if (this._inputValue !== null) {
          const val = this._inputValue;
          this._inputValue = null;
          return val;
        }
        this._waitingForInput = true;
        return '';
      }
      case 'sorted': {
        const arr = Array.isArray(args[0]) ? [...args[0]] : [...args[0]];
        arr.sort((a, b) => {
          if (typeof a === 'number' && typeof b === 'number') return a - b;
          return String(a).localeCompare(String(b));
        });
        return arr;
      }
      case 'list': {
        if (args.length === 0) return [];
        const v = args[0];
        if (typeof v === 'string') return [...v];
        if (Array.isArray(v)) return [...v];
        if (v && typeof v === 'object') return Object.entries(v);
        return [v];
      }
      case 'dict': {
        if (args.length === 0) return {};
        if (Array.isArray(args[0])) {
          const d = {};
          for (const pair of args[0]) { if (Array.isArray(pair) && pair.length >= 2) d[pair[0]] = pair[1]; }
          return d;
        }
        return {};
      }
      case 'tuple': {
        if (args.length === 0) return [];
        return Array.isArray(args[0]) ? [...args[0]] : [args[0]];
      }
      case 'set': {
        if (args.length === 0) return [];
        const arr = Array.isArray(args[0]) ? args[0] : [...args[0]];
        return [...new Set(arr)];
      }
      case 'enumerate': {
        const arr = args[0];
        const start = args.length > 1 ? args[1] : 0;
        return arr.map((item, i) => [i + start, item]);
      }
      case 'zip': {
        const minLen = Math.min(...args.map((a) => a.length));
        const result = [];
        for (let i = 0; i < minLen; i++) result.push(args.map((a) => a[i]));
        return result;
      }
      case 'map': {
        // Simplified: map(func, iterable)
        const func = args[0];
        const iterable = args[1];
        return iterable.map((item) => {
          if (func && func.__builtin__) return this.callBuiltin(func.__builtin__, [item]);
          if (func && func.__userFunc__) return this.callUserFunction(func, [item]);
          throw new Error('TypeError: first argument to map() must be callable');
        });
      }
      case 'isinstance': {
        const obj = args[0];
        const typeName = args[1];
        const actual = pyType(obj);
        if (typeof typeName === 'string') return actual === typeName;
        if (typeName && typeName.__builtin__) return actual === typeName.__builtin__;
        return false;
      }
      case 'ord': return args[0].charCodeAt(0);
      case 'chr': return String.fromCharCode(args[0]);
      case 'hex': return '0x' + args[0].toString(16);
      case 'bin': return '0b' + args[0].toString(2);
      case 'oct': return '0o' + args[0].toString(8);
      case 'pow': {
        if (args.length === 2) return Math.pow(args[0], args[1]);
        return Math.pow(args[0], args[1]) % args[2]; // pow(a,b,mod)
      }
      default:
        throw new Error(`NameError: name '${name}' is not defined`);
    }
  }
  /* ── User classes and functions ────────────────────────────────────────── */
  instantiateClass(classDef, args) {
    // Create new object instance
    const obj = {
      __userClass__: classDef.name,
    };
    
    // Call __init__ if defined
    if (classDef.methods['__init__']) {
      // Pass the new object as the first argument (`self`)
      this.callUserFunction(classDef.methods['__init__'], [obj, ...args]);
    }
    
    return obj;
  }

  callUserFunction(funcObj, args) {
    const { params, defaults, bodyStart, bodyEnd, defIndent } = funcObj;
    // Create new scope
    const localScope = {};
    for (let i = 0; i < params.length; i++) {
      if (i < args.length) {
        localScope[params[i]] = args[i];
      } else if (params[i] in defaults) {
        localScope[params[i]] = this._evalExpr(defaults[params[i]]);
      } else {
        localScope[params[i]] = null;
      }
    }
    // Push call frame
    this.callStack.push({
      returnPC: this.pc + 1,
      scopeIndex: this.scope.length,
      loopStackLen: this.loopStack.length,
      funcName: funcObj.__name__ || 'anonymous',
    });
    this.scope.push(localScope);
    // Execute function body synchronously (for step-through, we inline)
    this._lastReturnValue = null;
    const savedPC = this.pc;
    this.pc = bodyStart;
    // Execute all lines in the function body
    while (this.pc <= bodyEnd && this.pc < this.lines.length) {
      const line = this.lines[this.pc];
      // Skip blank/comment lines
      if (line.type === 'BLANK' || line.type === 'COMMENT') { this.pc++; continue; }
      // Check if we've left the function body by indent
      if (line.indent <= defIndent && this.pc > bodyStart) break;
      // Handle nested function defs inside the body
      if (line.type === 'FUNC_DEF') {
        const name = line.targets[0];
        const funcInfo = this.functions[name];
        if (funcInfo) {
          this.scope[this.scope.length - 1][name] = {
            __userFunc__: true,
            __name__: name,
            ...funcInfo,
          };
          this.pc = funcInfo.bodyEnd + 1;
          continue;
        }
      }
      // Handle return
      if (line.type === 'RETURN') {
        const retExpr = line.raw.trim().slice(6).trim();
        if (retExpr) {
          this._lastReturnValue = this._evalExpr(retExpr);
        }
        break;
      }
      // Handle assignment
      if (line.type === 'ASSIGN_LITERAL' || line.type === 'ASSIGN_CALC' || line.type === 'ASSIGN_CALL') {
        this._execAssignInline(line);
        this.pc++;
        continue;
      }
      // Handle import
      if (line.type === 'IMPORT') {
        this._execImportInline(line);
        this.pc++;
        continue;
      }
      // Handle print inside functions
      if (line.type === 'PRINT') {
        this._execPrintInline(line);
        this.pc++;
        continue;
      }
      // Handle conditionals
      if (line.type === 'CONDITIONAL' || line.type === 'ELIF') {
        const trimmed = line.raw.trim();
        let condStr;
        if (line.type === 'ELIF') condStr = trimmed.slice(5, -1).trim();
        else condStr = trimmed.slice(3, -1).trim();
        if (isTruthy(this._evalExpr(condStr))) {
          this.pc++;
        } else {
          this._skipToNextBranch(line.indent);
        }
        continue;
      }
      if (line.type === 'ELSE') {
        this.pc++;
        continue;
      }
      // Handle for loops inside functions
      if (line.type === 'LOOP_FOR') {
        this._execForInline(line);
        continue;
      }
      // Handle while loops inside functions
      if (line.type === 'LOOP_WHILE') {
        this._execWhileInline(line);
        continue;
      }
      // Handle expressions (method calls, break, continue, pass)
      if (line.type === 'EXPRESSION') {
        const t = line.raw.trim();
        if (t === 'break') break;
        if (t === 'continue') { this.pc++; continue; }
        if (t === 'pass') { this.pc++; continue; }
        this._evalExpr(t);
        this.pc++;
        continue;
      }
      // Default: advance
      this.pc++;
    }
    // Pop scope
    if (this.callStack.length > 0) {
      const frame = this.callStack.pop();
      while (this.scope.length > frame.scopeIndex) this.scope.pop();
      while (this.loopStack.length > frame.loopStackLen) this.loopStack.pop();
      this.pc = frame.returnPC;
    } else {
      this.pc = savedPC + 1;
    }
    return this._lastReturnValue;
  }
  /* ── Inline execution helpers (used inside function calls) ──────── */
  _execAssignInline(ld) {
    const trimmed = ld.raw.trim();
    const topScope = this.scope[this.scope.length - 1];
    const augOps = ['**=', '//=', '+=', '-=', '*=', '/=', '%='];
    let augOp = null, augIdx = -1;
    for (const op of augOps) {
      const idx = this._findAugAssignment(trimmed, op);
      if (idx !== -1) { augOp = op; augIdx = idx; break; }
    }
    if (augOp !== null) {
      const lhs = trimmed.slice(0, augIdx).trim();
      const rhsStr = trimmed.slice(augIdx + augOp.length).trim();
      const rhsVal = this._evalExpr(rhsStr);
      const baseOp = augOp.slice(0, -1);
      if (lhs.includes('[')) {
        const baseExpr = lhs.slice(0, lhs.indexOf('['));
        const idxExpr = lhs.slice(lhs.indexOf('[') + 1, lhs.lastIndexOf(']'));
        const baseObj = this._evalExpr(baseExpr);
        const idx = this._evalExpr(idxExpr);
        const oldVal = Array.isArray(baseObj) ? baseObj[idx < 0 ? baseObj.length + idx : idx] : baseObj[idx];
        const newVal = this._applyOp(oldVal, baseOp, rhsVal);
        if (Array.isArray(baseObj)) baseObj[idx < 0 ? baseObj.length + idx : idx] = newVal;
        else baseObj[idx] = newVal;
      } else {
        const currentVal = this._evalExpr(lhs);
        this._setVar(lhs, this._applyOp(currentVal, baseOp, rhsVal));
      }
      return;
    }
    const eqIdx = this._findAssignEquals(trimmed);
    if (eqIdx === -1) return;
    const lhs = trimmed.slice(0, eqIdx).trim();
    const rhsStr = trimmed.slice(eqIdx + 1).trim();
    const lhsParts = this._splitTopLevel(lhs, ',');
    if (lhsParts.length > 1) {
      const rhsVal = this._evalExpr(rhsStr);
      let values;
      if (Array.isArray(rhsVal)) {
        values = rhsVal;
      } else {
        const rhsParts = this._splitTopLevel(rhsStr, ',');
        values = rhsParts.length > 1 ? rhsParts.map((p) => this._evalExpr(p.trim())) : [rhsVal];
      }
      for (let i = 0; i < lhsParts.length; i++) {
        this._assignTarget(lhsParts[i].trim(), i < values.length ? values[i] : null);
      }
    } else {
      const target = lhs.trim();
      const rhsVal = this._evalExpr(rhsStr);
      this._assignTarget(target, rhsVal);
    }
  }
  _execPrintInline(ld) {
    const trimmed = ld.raw.trim();
    const innerMatch = trimmed.match(/^print\s*\(([\s\S]*)\)\s*$/);
    if (innerMatch) {
      const inner = innerMatch[1].trim();
      if (inner === '') {
        this.output.push('');
      } else {
        const args = this._splitPrintArgs(inner);
        let sep = ' ', end = '\n';
        const posArgs = [];
        for (const arg of args) {
          const ta = arg.trim();
          if (ta.startsWith('sep=')) sep = this._evalExpr(ta.slice(4).trim());
          else if (ta.startsWith('end=')) end = this._evalExpr(ta.slice(4).trim());
          else posArgs.push(this._evalExpr(ta));
        }
        this.output.push(posArgs.map(pyStr).join(sep));
      }
    }
  }
  _execForInline(ld) {
    const trimmed = ld.raw.trim();
    const match = trimmed.match(/^for\s+(.+?)\s+in\s+(.+):\s*$/);
    if (!match) { this.pc++; return; }
    const varExpr = match[1].trim();
    const iterExpr = match[2].trim();
    const iterVal = this._evalExpr(iterExpr);
    const indent = ld.indent;
    const startPC = this.pc;
    const bodyEnd = this._findBlockEnd(startPC, indent);
    let iterator;
    if (Array.isArray(iterVal)) iterator = iterVal;
    else if (typeof iterVal === 'string') iterator = [...iterVal];
    else if (iterVal && typeof iterVal === 'object') iterator = Object.keys(iterVal);
    else { this.pc = bodyEnd + 1; return; }
    if (iterator.length === 0) { this.pc = bodyEnd + 1; return; }
    for (let idx = 0; idx < iterator.length; idx++) {
      this._assignIterVar(varExpr, iterator[idx]);
      this.pc = startPC + 1;
      let breakHit = false;
      while (this.pc <= bodyEnd && this.pc < this.lines.length) {
        const line = this.lines[this.pc];
        if (line.type === 'BLANK' || line.type === 'COMMENT') { this.pc++; continue; }
        if (line.indent <= indent && this.pc > startPC) break;
        const t = line.raw.trim();
        if (t === 'break') { breakHit = true; break; }
        if (t === 'continue') break;
        if (t === 'pass') { this.pc++; continue; }
        if (line.type === 'RETURN') {
          const retExpr = t.slice(6).trim();
          if (retExpr) this._lastReturnValue = this._evalExpr(retExpr);
          // Signal return up
          this.pc = bodyEnd + 1;
          return; // return will be caught by caller
        }
        if (line.type === 'ASSIGN_LITERAL' || line.type === 'ASSIGN_CALC' || line.type === 'ASSIGN_CALL') {
          this._execAssignInline(line);
          this.pc++;
          continue;
        }
        if (line.type === 'IMPORT') {
          this._execImportInline(line);
          this.pc++;
          continue;
        }
        if (line.type === 'PRINT') { this._execPrintInline(line); this.pc++; continue; }
        if (line.type === 'CONDITIONAL' || line.type === 'ELIF') {
          const cTrimmed = t;
          let condStr;
          if (line.type === 'ELIF') condStr = cTrimmed.slice(5, -1).trim();
          else condStr = cTrimmed.slice(3, -1).trim();
          if (isTruthy(this._evalExpr(condStr))) this.pc++;
          else this._skipToNextBranch(line.indent);
          continue;
        }
        if (line.type === 'ELSE') { this.pc++; continue; }
        if (line.type === 'LOOP_FOR') { this._execForInline(line); continue; }
        if (line.type === 'LOOP_WHILE') { this._execWhileInline(line); continue; }
        if (line.type === 'EXPRESSION') {
          this._evalExpr(t);
          this.pc++;
          continue;
        }
        this.pc++;
      }
      if (breakHit) break;
    }
    this.pc = bodyEnd + 1;
  }
  _execWhileInline(ld) {
    const trimmed = ld.raw.trim();
    const condStr = trimmed.slice(6, -1).trim();
    const indent = ld.indent;
    const startPC = this.pc;
    const bodyEnd = this._findBlockEnd(startPC, indent);
    let guard = 0;
    while (isTruthy(this._evalExpr(condStr)) && guard < MAX_STEPS) {
      guard++;
      this.pc = startPC + 1;
      let breakHit = false;
      while (this.pc <= bodyEnd && this.pc < this.lines.length) {
        const line = this.lines[this.pc];
        if (line.type === 'BLANK' || line.type === 'COMMENT') { this.pc++; continue; }
        if (line.indent <= indent && this.pc > startPC) break;
        const t = line.raw.trim();
        if (t === 'break') { breakHit = true; break; }
        if (t === 'continue') break;
        if (t === 'pass') { this.pc++; continue; }
        if (line.type === 'RETURN') {
          const retExpr = t.slice(6).trim();
          if (retExpr) this._lastReturnValue = this._evalExpr(retExpr);
          this.pc = bodyEnd + 1;
          return;
        }
        if (line.type === 'ASSIGN_LITERAL' || line.type === 'ASSIGN_CALC' || line.type === 'ASSIGN_CALL') {
          this._execAssignInline(line);
          this.pc++;
          continue;
        }
        if (line.type === 'IMPORT') {
          this._execImportInline(line);
          this.pc++;
          continue;
        }
        if (line.type === 'PRINT') { this._execPrintInline(line); this.pc++; continue; }
        if (line.type === 'CONDITIONAL' || line.type === 'ELIF') {
          let cond;
          if (line.type === 'ELIF') cond = t.slice(5, -1).trim();
          else cond = t.slice(3, -1).trim();
          if (isTruthy(this._evalExpr(cond))) this.pc++;
          else this._skipToNextBranch(line.indent);
          continue;
        }
        if (line.type === 'ELSE') { this.pc++; continue; }
        if (line.type === 'LOOP_FOR') { this._execForInline(line); continue; }
        if (line.type === 'LOOP_WHILE') { this._execWhileInline(line); continue; }
        if (line.type === 'EXPRESSION') {
          this._evalExpr(t);
          this.pc++;
          continue;
        }
        this.pc++;
      }
      if (breakHit) break;
    }
    this.pc = bodyEnd + 1;
  }
  /* ── Assignment target helper ─────────────────────────────────────── */
  _assignTarget(target, value) {
    target = target.trim();
    if (target.includes('[') && !target.startsWith('[')) {
      const bracketStart = target.indexOf('[');
      const baseExpr = target.slice(0, bracketStart);
      const idxExpr = target.slice(bracketStart + 1, target.lastIndexOf(']'));
      const baseObj = this._evalExpr(baseExpr);
      const idx = this._evalExpr(idxExpr);
      if (Array.isArray(baseObj)) baseObj[idx < 0 ? baseObj.length + idx : idx] = value;
      else if (typeof baseObj === 'object') baseObj[idx] = value;
    } else if (target.includes('.') && !target.startsWith('.')) {
      const dotIdx = target.lastIndexOf('.');
      const baseExpr = target.slice(0, dotIdx);
      const attr = target.slice(dotIdx + 1);
      const baseObj = this._evalExpr(baseExpr);
      if (typeof baseObj === 'object' && baseObj !== null) {
        baseObj[attr] = value;
      } else {
        throw new Error(`AttributeError: '${typeof baseObj}' object has no attribute '${attr}'`);
      }
    } else {
      this._setVar(target, value);
    }
  }
  /* ── Operator helper for augmented assignment ─────────────────────── */
  _applyOp(left, op, right) {
    switch (op) {
      case '+':
        if (typeof left === 'string') return left + String(right);
        if (Array.isArray(left) && Array.isArray(right)) return [...left, ...right];
        return left + right;
      case '-': return left - right;
      case '*':
        if (typeof left === 'string' && typeof right === 'number') return left.repeat(right);
        return left * right;
      case '/':
        if (right === 0) throw new Error('ZeroDivisionError: division by zero');
        return left / right;
      case '//':
        if (right === 0) throw new Error('ZeroDivisionError: integer division by zero');
        return Math.floor(left / right);
      case '%':
        if (right === 0) throw new Error('ZeroDivisionError: modulo by zero');
        return ((left % right) + right) % right;
      case '**': return Math.pow(left, right);
      default: return left;
    }
  }
  /* ── String-level helpers (for finding = and augmented ops) ──────── */
  _findAssignEquals(line) {
    let depth = 0, inSingle = false, inDouble = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      if (!inSingle && !inDouble) {
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) depth--;
        if (ch === '=' && depth === 0) {
          const prev = i > 0 ? line[i - 1] : '';
          const next = i < line.length - 1 ? line[i + 1] : '';
          if (next === '=' || prev === '!' || prev === '<' || prev === '>' || prev === '=') continue;
          if ('+-*/%'.includes(prev)) continue;
          return i;
        }
      }
    }
    return -1;
  }
  _findAugAssignment(line, op) {
    let depth = 0, inSingle = false, inDouble = false;
    for (let i = 0; i <= line.length - op.length; i++) {
      const ch = line[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      if (!inSingle && !inDouble) {
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) depth--;
        if (depth === 0 && line.slice(i, i + op.length) === op) {
          // Make sure the character before isn't part of a larger operator
          // e.g. for +=, char before + shouldn't be another operator
          const before = i > 0 ? line[i - 1] : ' ';
          if (op === '+=' || op === '-=' || op === '%=') {
            if (!' \t)]}0123456789'.includes(before) && !/[a-zA-Z_]/.test(before)) continue;
          }
          // For //= make sure it's not inside something weird
          if (op === '//=') {
            if (i > 0 && line[i - 1] === '/') continue;
          }
          if (op === '**=') {
            if (i > 0 && line[i - 1] === '*') continue;
          }
          return i;
        }
      }
    }
    return -1;
  }
  _splitTopLevel(text, sep) {
    const parts = [];
    let depth = 0, inSingle = false, inDouble = false, current = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === "'" && !inDouble) inSingle = !inSingle;
      else if (ch === '"' && !inSingle) inDouble = !inDouble;
      if (!inSingle && !inDouble) {
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) depth--;
      }
      if (ch === sep && depth === 0 && !inSingle && !inDouble) {
        parts.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    parts.push(current);
    return parts;
  }
  /* ── Snapshot creation ────────────────────────────────────────────── */
  _makeSnapshot(error, isComplete, ld, changedVarNames) {
    if (!ld && this.pc < this.lines.length) ld = this.lines[this.pc];
    if (!ld) ld = this.lines[this.lines.length - 1] || { lineNumber: 0, raw: '', type: 'BLANK', flow: [], targets: [], sources: [], action: '', indent: 0 };
    // Build variables map from all scopes
    const variables = {};
    const changedSet = new Set(changedVarNames || []);
    for (let s = 0; s < this.scope.length; s++) {
      for (const [name, val] of Object.entries(this.scope[s])) {
        // Skip internal objects in the display
        if (val && typeof val === 'object' && (val.__userFunc__ || val.__module__)) {
          variables[name] = {
            value: val.__userFunc__ ? `<function ${val.__name__}>` : `<module '${val.__module__}'>`,
            type: val.__userFunc__ ? 'function' : 'module',
            changed: changedSet.has(name),
          };
          continue;
        }
        variables[name] = {
          value: deepClone(val),
          type: pyType(val),
          changed: changedSet.has(name),
        };
      }
    }
    // Build flow animations
    const flowAnimations = (ld.flow || []).map((f, i) => ({
      from: f.from,
      to: f.to,
      label: ld.action || '',
      delay: i * 200,
    }));
    return {
      step: this.stepCount,
      lineNumber: ld.lineNumber,
      lineDescriptor: { ...ld },
      variables,
      output: [...this.output],
      newOutput: null,
      cpuAction: ld.action || (error ? `Error: ${error}` : ''),
      flowAnimations,
      error: error || null,
      imports: [...this.imports],
      isComplete: isComplete || false,
      callStack: this.callStack.map(f => ({ ...f })), // Expose for visualization
      // Internal state for stepBack restoration
      _state: {
        pc: this.pc,
        scope: this.scope.map((s) => {
          const copy = {};
          for (const [k, v] of Object.entries(s)) copy[k] = deepClone(v);
          return copy;
        }),
        output: [...this.output],
        imports: [...this.imports],
        loopStack: JSON.parse(JSON.stringify(this.loopStack.map((l) => ({
          ...l,
          iterator: l.iterator ? [...l.iterator] : undefined,
        })))),
        callStack: [...this.callStack.map((f) => ({ ...f }))],
        finished: this.finished,
        functions: { ...this.functions },
      },
    };
  }
  _lastSnapshot() {
    if (this.snapshots.length === 0) return this._makeSnapshot(null, this.finished);
    return this.snapshots[this.snapshots.length - 1];
  }
  _restoreFromSnapshot(snap) {
    if (!snap._state) return;
    const st = snap._state;
    this.pc = st.pc;
    this.scope = st.scope.map((s) => {
      const copy = {};
      for (const [k, v] of Object.entries(s)) copy[k] = deepClone(v);
      return copy;
    });
    this.output = [...st.output];
    this.imports = [...st.imports];
    this.loopStack = JSON.parse(JSON.stringify(st.loopStack));
    this.callStack = st.callStack.map((f) => ({ ...f }));
    this.finished = st.finished;
    this.stepCount = snap.step;
    this.error = snap.error;
    // Re-register functions from scope
    this.functions = { ...st.functions };
    // Restore function references in scope
    for (const s of this.scope) {
      for (const [name, val] of Object.entries(s)) {
        if (val && typeof val === 'object' && val.__userFunc__) {
          // Re-link to functions registry
          if (this.functions[val.__name__]) {
            Object.assign(val, this.functions[val.__name__]);
          }
        }
      }
    }
  }
}
/* ── Step-through control flow: advancing past block ends ───────────── */
// Patch the step method to handle block-end detection
const _origStep = Interpreter.prototype._executeStep;
Interpreter.prototype._executeStep = function () {
  const snap = _origStep.call(this);
  // After executing a line, check if we need to loop back
  if (!this.finished && !this._waitingForInput) {
    this._checkBlockEnd();
  }
  return snap;
};
