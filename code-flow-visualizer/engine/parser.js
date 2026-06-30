// engine/parser.js
// ---------------------------------------------------------------------------
// Python-like code parser – produces structured LineDescriptor objects for
// every source line so the visualiser can animate data-flow between zones
// (disk, ram, engine, output).
// ---------------------------------------------------------------------------

/* ── Built-in names the parser recognises ────────────────────────────── */

const BUILTIN_FUNCTIONS = new Set([
  'print', 'len', 'range', 'int', 'str', 'float', 'bool', 'input',
  'type', 'abs', 'min', 'max', 'sum', 'round',
]);

const BUILTIN_METHODS = new Set([
  'append', 'pop', 'insert', 'sort', 'reverse',          // list
  'keys', 'values', 'items',                              // dict
  'upper', 'lower', 'strip', 'split', 'join', 'replace', 'find', // string
]);

const KEYWORDS = new Set([
  'if', 'elif', 'else', 'for', 'while', 'def', 'return', 'import', 'from',
  'and', 'or', 'not', 'in', 'True', 'False', 'None', 'break', 'continue',
  'class', 'pass', 'is', 'as', 'with', 'try', 'except', 'finally', 'raise',
  'yield', 'lambda', 'global', 'nonlocal', 'del', 'assert',
]);

/* ── Helpers ─────────────────────────────────────────────────────────── */

/**
 * Return the number of leading spaces on `line`.
 */
function countLeadingSpaces(line) {
  let n = 0;
  for (const ch of line) {
    if (ch === ' ') n++;
    else if (ch === '\t') n += 4;
    else break;
  }
  return n;
}

/**
 * Strip string quotes and return the inner text.
 */
function stripQuotes(s) {
  s = s.trim();
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"'))
  ) {
    return s.slice(1, -1);
  }
  if (
    (s.startsWith("f'") && s.endsWith("'")) ||
    (s.startsWith('f"') && s.endsWith('"'))
  ) {
    return s.slice(2, -1);
  }
  return s;
}

/**
 * Return true when `expr` looks like a literal value
 * (number, string, boolean, None, list literal, dict literal, tuple literal).
 */
function isLiteral(expr) {
  expr = expr.trim();
  if (expr === '') return false;

  // Boolean / None
  if (['True', 'False', 'None'].includes(expr)) return true;

  // Numeric (int / float, including negatives)
  if (/^-?\d+(\.\d+)?$/.test(expr)) return true;

  // String literal
  if (/^f?["']/.test(expr) && /["']$/.test(expr)) return true;

  // List / dict / tuple literal that is *entirely* composed of literals
  if (
    (expr.startsWith('[') && expr.endsWith(']')) ||
    (expr.startsWith('{') && expr.endsWith('}')) ||
    (expr.startsWith('(') && expr.endsWith(')'))
  ) {
    const inner = expr.slice(1, -1).trim();
    if (inner === '') return true; // empty collection
    // Quick heuristic: no identifiers that aren't keywords/literals
    const parts = splitTopLevel(inner, ',');
    return parts.every((p) => isLiteral(p.trim()));
  }

  return false;
}

/**
 * Split `text` by `sep` only when not inside brackets / parens / quotes.
 */
function splitTopLevel(text, sep) {
  const parts = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let current = '';

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

/**
 * Find the top-level `=` (assignment) position, skipping `==`, `!=`, `<=`, `>=`.
 * Returns the index of `=` or -1.
 */
function findAssignmentEquals(line) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;

    if (!inSingle && !inDouble) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;

      if (ch === '=' && depth === 0) {
        // Skip ==, !=, <=, >=
        const prev = i > 0 ? line[i - 1] : '';
        const next = i < line.length - 1 ? line[i + 1] : '';
        if (next === '=' || prev === '!' || prev === '<' || prev === '>' || prev === '=') {
          // Also skip += -= *= /= **= //= %=
          continue;
        }
        return i;
      }
    }
  }
  return -1;
}

/**
 * Find the top-level augmented assignment operator (+=, -=, *=, /=, //=, **=, %=).
 * Returns { index, op } or null.
 */
function findAugmentedAssignment(line) {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;

    if (!inSingle && !inDouble) {
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;

      if (depth === 0 && i < line.length - 1 && line[i + 1] === '=') {
        if ('+-*/%'.includes(ch)) {
          // Disambiguate //= and **=
          if (ch === '/' && i + 2 < line.length && line[i + 2] === '=') {
            // could be //= ?  check line[i] and line[i-1]
          }
          if (ch === '*' && i > 0 && line[i - 1] === '*') {
            return { index: i - 1, op: '**=' };
          }
          if (ch === '/' && i > 0 && line[i - 1] === '/') {
            return { index: i - 1, op: '//=' };
          }
          return { index: i, op: ch + '=' };
        }
      }
    }
  }
  return null;
}

/* ── Variable extraction ─────────────────────────────────────────────── */

/**
 * Extract identifiers referenced (read) in an expression string.
 */
function extractIdentifiers(expr) {
  if (typeof expr !== 'string') return [];
  // Match word characters but exclude numbers-only, strings, keywords
  const ids = new Set();

  // Temporarily remove string literals so their contents aren't matched
  let cleaned = expr.replace(/f?"""[\s\S]*?"""/g, '""');
  cleaned = cleaned.replace(/f?'''[\s\S]*?'''/g, "''");
  cleaned = cleaned.replace(/f?"(?:[^"\\]|\\.)*"/g, '""');
  cleaned = cleaned.replace(/f?'(?:[^'\\]|\\.)*'/g, "''");

  const re = /\b([a-zA-Z_]\w*)\b/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const name = m[1];
    if (!KEYWORDS.has(name) && !BUILTIN_FUNCTIONS.has(name) && !BUILTIN_METHODS.has(name)) {
      ids.add(name);
    }
  }

  // Also extract identifiers inside f-string interpolations from the original
  const fstringRe = /f["'].*?\{([^}]+)\}.*?["']/g;
  let fm;
  while ((fm = fstringRe.exec(expr)) !== null) {
    const inner = fm[1];
    const innerIds = extractIdentifiers(inner);
    innerIds.forEach((id) => ids.add(id));
  }

  return [...ids];
}

/**
 * Extract the targets (LHS) of an assignment.  Handles `a, b = ...` and `a = ...`.
 */
function extractTargets(lhs) {
  const parts = splitTopLevel(lhs.trim(), ',');
  const targets = [];
  for (const p of parts) {
    const t = p.trim();
    // Could be `a` or `a[0]` or `a.x`
    const baseMatch = t.match(/^([a-zA-Z_]\w*)/);
    if (baseMatch) targets.push(baseMatch[1]);
  }
  return targets;
}

/* ── Detect function / method calls in expression ────────────────────── */

function containsCall(expr) {
  // Returns true if expression contains a function or method call
  return /\b([a-zA-Z_]\w*)\s*\(/.test(expr);
}

function extractCalledFunctions(expr) {
  const fns = [];
  const re = /\b([a-zA-Z_]\w*)\s*\(/g;
  let m;
  while ((m = re.exec(expr)) !== null) {
    fns.push(m[1]);
  }
  return fns;
}

function containsMethod(expr) {
  return /\.\s*([a-zA-Z_]\w*)\s*\(/.test(expr);
}

function extractCalledMethods(expr) {
  const methods = [];
  const re = /\.\s*([a-zA-Z_]\w*)\s*\(/g;
  let m;
  while ((m = re.exec(expr)) !== null) {
    methods.push(m[1]);
  }
  return methods;
}

/* ── Action string builders ──────────────────────────────────────────── */

function describeAssignLiteral(targets, rhs) {
  const val = rhs.trim();
  if (targets.length === 1) {
    return `Store value ${val} → ${targets[0]}`;
  }
  return `Store values → ${targets.join(', ')}`;
}

function describeAssignCalc(targets, rhs) {
  if (targets.length === 1) {
    return `Compute ${rhs.trim()} → ${targets[0]}`;
  }
  return `Compute ${rhs.trim()} → ${targets.join(', ')}`;
}

function describeAssignCall(targets, rhs) {
  const fns = extractCalledFunctions(rhs);
  const fnName = fns.length > 0 ? fns[0] : 'function';
  if (targets.length === 1) {
    return `Call ${fnName}() → ${targets[0]}`;
  }
  return `Call ${fnName}() → ${targets.join(', ')}`;
}

/* ── Main line classifier ────────────────────────────────────────────── */

function classifyLine(trimmed, raw) {
  const indent = Math.floor(countLeadingSpaces(raw) / 4);

  // Blank
  if (trimmed === '') {
    return { type: 'BLANK', flow: [], targets: [], sources: [], action: '', indent };
  }

  // Comment
  if (trimmed.startsWith('#')) {
    return { type: 'COMMENT', flow: [], targets: [], sources: [], action: '', indent };
  }

  // Import
  if (/^import\s+/.test(trimmed) || /^from\s+\S+\s+import\s+/.test(trimmed)) {
    const modules = [];
    if (trimmed.startsWith('from')) {
      const fm = trimmed.match(/^from\s+(\S+)\s+import/);
      if (fm) modules.push(fm[1]);
    } else {
      const im = trimmed.match(/^import\s+(.+)/);
      if (im) {
        im[1].split(',').forEach((m) => modules.push(m.trim()));
      }
    }
    return {
      type: 'IMPORT',
      flow: [
        { from: 'disk', to: 'engine' },
        { from: 'disk', to: 'ram' },
      ],
      targets: modules,
      sources: [],
      action: `Import module${modules.length > 1 ? 's' : ''}: ${modules.join(', ')}`,
      indent,
    };
  }

  // pass
  if (trimmed === 'pass') {
    return {
      type: 'EXPRESSION',
      flow: [],
      targets: [],
      sources: [],
      action: 'No operation (pass)',
      indent,
    };
  }

  // break
  if (trimmed === 'break') {
    return {
      type: 'EXPRESSION',
      flow: [],
      targets: [],
      sources: [],
      action: 'Break out of loop',
      indent,
    };
  }

  // continue
  if (trimmed === 'continue') {
    return {
      type: 'EXPRESSION',
      flow: [],
      targets: [],
      sources: [],
      action: 'Continue to next iteration',
      indent,
    };
  }

  // Function definition
  const defMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*:/);
  if (defMatch) {
    const funcName = defMatch[1];
    const params = defMatch[2]
      .split(',')
      .map((p) => p.trim().split('=')[0].trim())
      .filter(Boolean);
    return {
      type: 'FUNC_DEF',
      flow: [{ from: 'engine', to: 'ram' }],
      targets: [funcName],
      sources: [],
      action: `Define function ${funcName}(${params.join(', ')})`,
      indent,
    };
  }

  // Class definition
  const classMatch = trimmed.match(/^class\s+([a-zA-Z_]\w*)\s*(?:\([^)]*\))?\s*:/);
  if (classMatch) {
    const className = classMatch[1];
    return {
      type: 'CLASS_DEF',
      flow: [{ from: 'engine', to: 'ram' }],
      targets: [className],
      sources: [],
      action: `Define class ${className}`,
      indent,
    };
  }

  // Return
  if (/^return\b/.test(trimmed)) {
    const retExpr = trimmed.slice(6).trim();
    const sources = extractIdentifiers(retExpr);
    return {
      type: 'RETURN',
      flow: [{ from: 'ram', to: 'engine' }],
      targets: [],
      sources,
      action: retExpr ? `Return ${retExpr}` : 'Return (no value)',
      indent,
    };
  }

  // Print
  if (/^print\s*\(/.test(trimmed)) {
    const innerMatch = trimmed.match(/^print\s*\(([\s\S]*)\)\s*$/);
    const inner = innerMatch ? innerMatch[1].trim() : '';
    const sources = extractIdentifiers(inner);
    const hasVars = sources.length > 0;
    return {
      type: 'PRINT',
      flow: hasVars
        ? [
            { from: 'ram', to: 'engine' },
            { from: 'engine', to: 'output' },
          ]
        : [{ from: 'engine', to: 'output' }],
      targets: [],
      sources,
      action: `Print: ${inner || '(empty)'}`,
      indent,
    };
  }

  // If / elif / else
  if (/^if\s+/.test(trimmed) && trimmed.endsWith(':')) {
    const condExpr = trimmed.slice(3, -1).trim();
    const sources = extractIdentifiers(condExpr);
    return {
      type: 'CONDITIONAL',
      flow: [{ from: 'ram', to: 'engine' }],
      targets: [],
      sources,
      action: `Evaluate condition: ${condExpr}`,
      indent,
    };
  }

  if (/^elif\s+/.test(trimmed) && trimmed.endsWith(':')) {
    const condExpr = trimmed.slice(5, -1).trim();
    const sources = extractIdentifiers(condExpr);
    return {
      type: 'ELIF',
      flow: [{ from: 'ram', to: 'engine' }],
      targets: [],
      sources,
      action: `Evaluate elif: ${condExpr}`,
      indent,
    };
  }

  if (/^else\s*:/.test(trimmed)) {
    return {
      type: 'ELSE',
      flow: [],
      targets: [],
      sources: [],
      action: 'Enter else branch',
      indent,
    };
  }

  // For loop
  if (/^for\s+/.test(trimmed) && trimmed.endsWith(':')) {
    const forMatch = trimmed.match(/^for\s+(.+?)\s+in\s+(.+):\s*$/);
    if (forMatch) {
      const iterVar = forMatch[1].trim();
      const iterExpr = forMatch[2].trim();
      const targets = extractTargets(iterVar);
      const sources = extractIdentifiers(iterExpr);
      return {
        type: 'LOOP_FOR',
        flow: [{ from: 'ram', to: 'engine' }],
        targets,
        sources,
        action: `For loop: ${iterVar} in ${iterExpr}`,
        indent,
      };
    }
  }

  // While loop
  if (/^while\s+/.test(trimmed) && trimmed.endsWith(':')) {
    const condExpr = trimmed.slice(6, -1).trim();
    const sources = extractIdentifiers(condExpr);
    return {
      type: 'LOOP_WHILE',
      flow: [{ from: 'ram', to: 'engine' }],
      targets: [],
      sources,
      action: `While loop: ${condExpr}`,
      indent,
    };
  }

  // ── Assignments (= and augmented +=, -=, etc.) ───────────────────

  // Check augmented assignment first
  const augmented = findAugmentedAssignment(trimmed);
  if (augmented) {
    const lhs = trimmed.slice(0, augmented.index).trim();
    const rhs = trimmed.slice(augmented.index + augmented.op.length).trim();
    const targets = extractTargets(lhs);
    const rhsSources = extractIdentifiers(rhs);
    const lhsSources = extractIdentifiers(lhs);
    const sources = [...new Set([...lhsSources, ...rhsSources])];
    const opSymbol = augmented.op.slice(0, -1); // e.g. '+'
    return {
      type: 'ASSIGN_CALC',
      flow: [
        { from: 'ram', to: 'engine' },
        { from: 'engine', to: 'ram' },
      ],
      targets,
      sources,
      action: `Compute ${lhs} ${opSymbol} ${rhs} → ${targets.join(', ')}`,
      indent,
    };
  }

  // Regular assignment
  const eqIdx = findAssignmentEquals(trimmed);
  if (eqIdx !== -1) {
    const lhs = trimmed.slice(0, eqIdx).trim();
    const rhs = trimmed.slice(eqIdx + 1).trim();
    const targets = extractTargets(lhs);

    // input() call
    if (/\binput\s*\(/.test(rhs)) {
      const sources = extractIdentifiers(rhs);
      return {
        type: 'INPUT',
        flow: [{ from: 'engine', to: 'ram' }],
        targets,
        sources,
        action: `Read input → ${targets.join(', ')}`,
        indent,
      };
    }

    // Determine assignment sub-type
    if (isLiteral(rhs)) {
      return {
        type: 'ASSIGN_LITERAL',
        flow: [{ from: 'engine', to: 'ram' }],
        targets,
        sources: [],
        action: describeAssignLiteral(targets, rhs),
        indent,
      };
    }

    if (containsCall(rhs)) {
      const sources = extractIdentifiers(rhs);
      return {
        type: 'ASSIGN_CALL',
        flow: [
          { from: 'ram', to: 'engine' },
          { from: 'engine', to: 'ram' },
        ],
        targets,
        sources,
        action: describeAssignCall(targets, rhs),
        indent,
      };
    }

    // Otherwise it's a calculation / expression
    const sources = extractIdentifiers(rhs);
    if (sources.length === 0 && !containsCall(rhs)) {
      // Pure literal expression (e.g. list comprehension result that looks odd)
      return {
        type: 'ASSIGN_LITERAL',
        flow: [{ from: 'engine', to: 'ram' }],
        targets,
        sources: [],
        action: describeAssignLiteral(targets, rhs),
        indent,
      };
    }
    return {
      type: 'ASSIGN_CALC',
      flow: [
        { from: 'ram', to: 'engine' },
        { from: 'engine', to: 'ram' },
      ],
      targets,
      sources,
      action: describeAssignCalc(targets, rhs),
      indent,
    };
  }

  // ── Standalone expressions (method calls, etc.) ───────────────────

  if (containsCall(trimmed) || containsMethod(trimmed)) {
    const sources = extractIdentifiers(trimmed);
    const fns = extractCalledFunctions(trimmed);
    const methods = extractCalledMethods(trimmed);
    const callName = methods.length > 0 ? `.${methods[0]}()` : fns.length > 0 ? `${fns[0]}()` : 'call';
    return {
      type: 'EXPRESSION',
      flow: [
        { from: 'ram', to: 'engine' },
        { from: 'engine', to: 'ram' },
      ],
      targets: sources.length > 0 ? [sources[0]] : [],
      sources,
      action: `Execute ${callName} on ${sources.length > 0 ? sources[0] : 'value'}`,
      indent,
    };
  }

  // ── Unknown fallback ──────────────────────────────────────────────

  const sources = extractIdentifiers(trimmed);
  return {
    type: 'UNKNOWN',
    flow: [],
    targets: [],
    sources,
    action: trimmed,
    indent,
  };
}

/* ── Public API ──────────────────────────────────────────────────────── */

/**
 * Parse raw Python-like source code into an array of LineDescriptor objects.
 *
 * @param {string} rawCode – the full source text
 * @returns {LineDescriptor[]}
 */
export function parseCode(rawCode) {
  if (typeof rawCode !== 'string') return [];
  const lines = rawCode.split('\n');
  const descriptors = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const classification = classifyLine(trimmed, raw);

    descriptors.push({
      lineNumber: i + 1,
      raw,
      type: classification.type,
      flow: classification.flow,
      targets: classification.targets,
      sources: classification.sources,
      action: classification.action,
      indent: classification.indent,
    });
  }

  return descriptors;
}
