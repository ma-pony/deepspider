/**
 * JSForge - AST 分析器
 * 函数依赖图、变量作用域、调用链追踪、代码切片
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';

export class ASTAnalyzer {
  constructor() {
    this.ast = null;
    this.code = '';
  }

  parse(code) {
    this.code = code;
    this.ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
    return this.ast;
  }

  _getMemberPath(node) {
    if (!node) return '';
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'ThisExpression') return 'this';
    if (node.type === 'MemberExpression') {
      const obj = this._getMemberPath(node.object);
      const prop = node.computed
        ? `[${node.property.name || node.property.value || '?'}]`
        : node.property.name || node.property.value;
      return obj ? `${obj}.${prop}` : prop;
    }
    return '';
  }

  extractFunctions(code) {
    const ast = this.parse(code);
    const functions = [];

    traverse.default(ast, {
      FunctionDeclaration: (path) => {
        const node = path.node;
        functions.push({
          type: 'declaration',
          name: node.id?.name || 'anonymous',
          params: node.params.map(p => this._getParamName(p)),
          start: node.start,
          end: node.end,
          loc: node.loc,
        });
      },
      FunctionExpression: (path) => {
        const node = path.node;
        functions.push({
          type: 'expression',
          name: node.id?.name || 'anonymous',
          params: node.params.map(p => this._getParamName(p)),
          start: node.start,
          end: node.end,
          loc: node.loc,
        });
      },
      ArrowFunctionExpression: (path) => {
        const node = path.node;
        functions.push({
          type: 'arrow',
          name: 'arrow',
          params: node.params.map(p => this._getParamName(p)),
          start: node.start,
          end: node.end,
          loc: node.loc,
        });
      }
    });

    return functions;
  }

  _getParamName(param) {
    if (param.type === 'Identifier') return param.name;
    if (param.type === 'RestElement') return `...${param.argument.name}`;
    if (param.type === 'AssignmentPattern') return param.left.name;
    if (param.type === 'ObjectPattern') return '{...}';
    if (param.type === 'ArrayPattern') return '[...]';
    return 'param';
  }

  extractCalls(code) {
    const ast = this.parse(code);
    const calls = [];

    traverse.default(ast, {
      CallExpression: (path) => {
        const node = path.node;
        let name = '';
        if (node.callee.type === 'Identifier') {
          name = node.callee.name;
        } else if (node.callee.type === 'MemberExpression') {
          name = this._getMemberPath(node.callee);
        }
        calls.push({
          name,
          args: node.arguments.length,
          start: node.start,
          loc: node.loc
        });
      }
    });

    return calls;
  }

  // 构建函数依赖图
  buildDependencyGraph(code) {
    const ast = this.parse(code);
    const graph = new Map();
    const funcNames = new Set();
    const funcCalls = new Map();

    // 一次遍历收集函数定义和调用
    traverse.default(ast, {
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name;
        if (name) {
          funcNames.add(name);
          const calls = new Set();
          path.traverse({
            CallExpression(innerPath) {
              if (innerPath.node.callee.type === 'Identifier') {
                calls.add(innerPath.node.callee.name);
              }
            }
          });
          funcCalls.set(name, calls);
        }
      },
      VariableDeclarator: (path) => {
        const node = path.node;
        if ((node.init?.type === 'FunctionExpression' ||
            node.init?.type === 'ArrowFunctionExpression') &&
            node.id.type === 'Identifier') {
          const name = node.id.name;
          funcNames.add(name);
          const calls = new Set();
          path.traverse({
            CallExpression(innerPath) {
              if (innerPath.node.callee.type === 'Identifier') {
                calls.add(innerPath.node.callee.name);
              }
            }
          });
          funcCalls.set(name, calls);
        }
      }
    });

    // 过滤只保留内部函数调用
    for (const [name, calls] of funcCalls) {
      const filtered = Array.from(calls).filter(c => funcNames.has(c));
      graph.set(name, filtered);
    }

    return graph;
  }

  // 变量作用域分析
  analyzeScope(code) {
    const ast = this.parse(code);
    const scopes = [];

    traverse.default(ast, {
      FunctionDeclaration: (path) => {
        const node = path.node;
        scopes.push({
          type: 'function',
          name: node.id?.name,
          params: node.params.map(p => this._getParamName(p)),
        });
      },
      FunctionExpression: (path) => {
        const node = path.node;
        scopes.push({
          type: 'function',
          name: node.id?.name || 'anonymous',
          params: node.params.map(p => this._getParamName(p)),
        });
      },
    });

    return scopes;
  }

  // 代码切片提取（增强版 - 包含变量依赖）
  extractSlice(code, funcName) {
    const ast = this.parse(code);
    const graph = this.buildDependencyGraph(code);
    const needed = new Set([funcName]);
    const globalVars = new Set();

    // 递归收集函数依赖
    const collectFuncs = (name) => {
      const deps = graph.get(name) || [];
      for (const dep of deps) {
        if (!needed.has(dep)) {
          needed.add(dep);
          collectFuncs(dep);
        }
      }
    };
    collectFuncs(funcName);

    // 收集全局变量依赖
    traverse.default(ast, {
      FunctionDeclaration: (path) => {
        const node = path.node;
        if (node.id && needed.has(node.id.name)) {
          path.traverse({
            Identifier: (innerPath) => {
              if (!needed.has(innerPath.node.name)) {
                globalVars.add(innerPath.node.name);
              }
            }
          });
        }
      }
    });

    // 提取代码
    const slices = [];

    // 先提取全局变量
    traverse.default(ast, {
      VariableDeclaration: (path) => {
        const node = path.node;
        for (const decl of node.declarations) {
          if (decl.id.type === 'Identifier' && globalVars.has(decl.id.name)) {
            slices.push(this.code.slice(node.start, node.end));
            break;
          }
        }
      }
    });

    // 再提取函数
    traverse.default(ast, {
      FunctionDeclaration: (path) => {
        const node = path.node;
        if (node.id && needed.has(node.id.name)) {
          slices.push(this.code.slice(node.start, node.end));
        }
      },
      VariableDeclarator: (path) => {
        const node = path.node;
        if (node.id.type === 'Identifier' && needed.has(node.id.name)) {
          if (node.init?.type === 'FunctionExpression' ||
              node.init?.type === 'ArrowFunctionExpression') {
            const start = node.start;
            const end = node.end;
            slices.push(`var ${this.code.slice(start, end)};`);
          }
        }
      }
    });

    return slices.join('\n\n');
  }

  // 查找特定模式的调用（逆向分析常用）
  findCallPattern(code, pattern) {
    const ast = this.parse(code);
    const matches = [];
    const regex = new RegExp(pattern, 'i');

    traverse.default(ast, {
      CallExpression: (path) => {
        const node = path.node;
        const name = node.callee.type === 'Identifier'
          ? node.callee.name
          : this._getMemberPath(node.callee);

        if (regex.test(name)) {
          matches.push({
            name,
            args: node.arguments.map(a => this.code.slice(a.start, a.end)),
            start: node.start,
            end: node.end,
            loc: node.loc,
            code: this.code.slice(node.start, node.end)
          });
        }
      }
    });

    return matches;
  }

  // 查找赋值语句（追踪变量来源）
  findAssignments(code, varName) {
    const ast = this.parse(code);
    const assignments = [];

    traverse.default(ast, {
      AssignmentExpression: (path) => {
        const node = path.node;
        const left = node.left.type === 'Identifier'
          ? node.left.name
          : this._getMemberPath(node.left);

        if (left === varName || left.startsWith(varName + '.')) {
          assignments.push({
            target: left,
            operator: node.operator,
            value: this.code.slice(node.right.start, node.right.end),
            valueType: node.right.type,
            start: node.start,
            loc: node.loc
          });
        }
      },
      VariableDeclarator: (path) => {
        const node = path.node;
        if (node.id.type === 'Identifier' && node.id.name === varName && node.init) {
          assignments.push({
            target: varName,
            operator: '=',
            value: this.code.slice(node.init.start, node.init.end),
            valueType: node.init.type,
            start: node.start,
            loc: node.loc,
            isDeclaration: true
          });
        }
      }
    });

    return assignments;
  }

  // 提取字符串字面量（用于分析混淆代码）
  extractStrings(code) {
    const ast = this.parse(code);
    const strings = [];

    traverse.default(ast, {
      StringLiteral: (path) => {
        const node = path.node;
        if (node.value.length > 0) {
          strings.push({
            value: node.value,
            raw: node.extra?.raw || `"${node.value}"`,
            start: node.start,
            loc: node.loc
          });
        }
      },
      TemplateLiteral: (path) => {
        const node = path.node;
        node.quasis.forEach(q => {
          if (q.value.cooked) {
            strings.push({
              value: q.value.cooked,
              raw: q.value.raw,
              start: q.start,
              loc: q.loc,
              isTemplate: true
            });
          }
        });
      }
    });

    return strings;
  }

  // 生成代码（从 AST 还原）
  generate(ast) {
    return generate(ast || this.ast, {
      format: { indent: { style: '  ' }, quotes: 'single' }
    });
  }
}

export default ASTAnalyzer;
