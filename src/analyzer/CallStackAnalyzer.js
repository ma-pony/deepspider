/**
 * DeepSpider - 调用栈分析器
 * 入口点识别、函数调用图、数据流分析、参数追踪
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

export class CallStackAnalyzer {
  constructor() {
    this.ast = null;
    this.code = '';
    this.callGraph = new Map();
    this.funcMap = new Map();
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

  // 识别入口点
  findEntryPoints(code) {
    const ast = this.parse(code);
    const entries = [];

    traverse.default(ast, {
      CallExpression: (path) => {
        const node = path.node;
        // IIFE
        if (node.callee.type === 'FunctionExpression' ||
            node.callee.type === 'ArrowFunctionExpression') {
          entries.push({
            type: 'iife',
            start: node.start,
            loc: node.loc,
            code: this.code.slice(node.start, Math.min(node.start + 50, node.end)) + '...'
          });
        }
        // 常见入口调用
        if (node.callee.type === 'Identifier') {
          const name = node.callee.name;
          if (['main', 'init', 'start', 'run', 'bootstrap', 'setup'].includes(name)) {
            entries.push({ type: 'call', name, start: node.start, loc: node.loc });
          }
        }
        // DOMContentLoaded / onload
        if (node.callee.type === 'MemberExpression') {
          const memberPath = this._getMemberPath(node.callee);
          if (memberPath.includes('addEventListener') || memberPath.includes('onload')) {
            entries.push({ type: 'event', path: memberPath, start: node.start, loc: node.loc });
          }
        }
      },
      ExpressionStatement: (path) => {
        const node = path.node;
        if (node.expression.type === 'CallExpression') {
          const callee = node.expression.callee;
          if (callee.type === 'Identifier') {
            entries.push({
              type: 'toplevel-call',
              name: callee.name,
              start: node.start,
              loc: node.loc
            });
          }
        }
      }
    });

    return entries;
  }

  // 构建完整调用图（带调用者追踪）
  buildCallGraph(code) {
    const ast = this.parse(code);
    this.callGraph.clear();
    this.funcMap.clear();
    const self = this;

    // 单次遍历：收集函数定义并分析内部调用
    traverse.default(ast, {
      FunctionDeclaration(path) {
        const node = path.node;
        if (node.id) {
          const funcName = node.id.name;
          self.funcMap.set(funcName, {
            node,
            type: 'declaration',
            params: node.params.map(p => self._getParamName(p))
          });

          // 收集函数内的调用
          const calls = [];
          path.traverse({
            CallExpression(innerPath) {
              const callNode = innerPath.node;
              const callee = self._getCalleeName(callNode.callee);
              if (callee) {
                calls.push({
                  callee,
                  args: callNode.arguments.length,
                  argValues: callNode.arguments.map(a => self.code.slice(a.start, a.end)),
                  start: callNode.start,
                  loc: callNode.loc
                });
              }
            }
          });
          self.callGraph.set(funcName, calls);
        }
      },
      VariableDeclarator(path) {
        const node = path.node;
        if (node.id.type === 'Identifier' &&
            (node.init?.type === 'FunctionExpression' ||
             node.init?.type === 'ArrowFunctionExpression')) {
          const funcName = node.id.name;
          self.funcMap.set(funcName, {
            node: node.init,
            type: node.init.type === 'ArrowFunctionExpression' ? 'arrow' : 'expression',
            params: node.init.params.map(p => self._getParamName(p))
          });

          // 收集函数内的调用
          const calls = [];
          path.traverse({
            CallExpression(innerPath) {
              const callNode = innerPath.node;
              const callee = self._getCalleeName(callNode.callee);
              if (callee) {
                calls.push({
                  callee,
                  args: callNode.arguments.length,
                  argValues: callNode.arguments.map(a => self.code.slice(a.start, a.end)),
                  start: callNode.start,
                  loc: callNode.loc
                });
              }
            }
          });
          self.callGraph.set(funcName, calls);
        }
      },
      AssignmentExpression(path) {
        const node = path.node;
        if (node.left.type === 'Identifier' &&
            (node.right.type === 'FunctionExpression' ||
             node.right.type === 'ArrowFunctionExpression')) {
          const funcName = node.left.name;
          self.funcMap.set(funcName, {
            node: node.right,
            type: 'assigned',
            params: node.right.params.map(p => self._getParamName(p))
          });

          // 收集函数内的调用
          const calls = [];
          path.traverse({
            CallExpression(innerPath) {
              const callNode = innerPath.node;
              const callee = self._getCalleeName(callNode.callee);
              if (callee) {
                calls.push({
                  callee,
                  args: callNode.arguments.length,
                  argValues: callNode.arguments.map(a => self.code.slice(a.start, a.end)),
                  start: callNode.start,
                  loc: callNode.loc
                });
              }
            }
          });
          self.callGraph.set(funcName, calls);
        }
      }
    });

    // 分析全局作用域的调用
    const globalCalls = [];
    traverse.default(ast, {
      CallExpression: (path) => {
        const node = path.node;
        // 检查是否在函数内
        let inFunction = false;
        for (const [, funcInfo] of this.funcMap) {
          if (node.start >= funcInfo.node.start && node.end <= funcInfo.node.end) {
            inFunction = true;
            break;
          }
        }
        if (!inFunction) {
          const callee = this._getCalleeName(node.callee);
          if (callee) {
            globalCalls.push({
              callee,
              args: node.arguments.length,
              start: node.start,
              loc: node.loc
            });
          }
        }
      }
    });

    if (globalCalls.length > 0) {
      this.callGraph.set('__global__', globalCalls);
    }

    return this.callGraph;
  }

  _getCalleeName(callee) {
    if (callee.type === 'Identifier') return callee.name;
    if (callee.type === 'MemberExpression') return this._getMemberPath(callee);
    return null;
  }

  _getMemberPath(node) {
    if (!node) return '';
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'ThisExpression') return 'this';
    if (node.type === 'MemberExpression') {
      const obj = this._getMemberPath(node.object);
      const prop = node.computed
        ? `[${node.property.name || node.property.value || '?'}]`
        : (node.property.name || node.property.value);
      return obj ? `${obj}.${prop}` : String(prop);
    }
    return '';
  }

  _getParamName(param) {
    if (param.type === 'Identifier') return param.name;
    if (param.type === 'RestElement') return `...${param.argument?.name || 'rest'}`;
    if (param.type === 'AssignmentPattern') return param.left?.name || 'default';
    return 'param';
  }

  // 追踪参数传递（向上追溯）
  traceParameter(code, funcName, paramIndex) {
    this.buildCallGraph(code);
    const traces = [];

    // 找到所有调用该函数的地方
    for (const [caller, calls] of this.callGraph) {
      for (const call of calls) {
        if (call.callee === funcName && call.argValues[paramIndex]) {
          traces.push({
            caller,
            argValue: call.argValues[paramIndex],
            start: call.start,
            loc: call.loc
          });
        }
      }
    }

    return traces;
  }

  // 反向追踪：找到谁调用了指定函数
  findCallers(code, targetFunc) {
    this.buildCallGraph(code);
    const callers = [];

    for (const [caller, calls] of this.callGraph) {
      for (const call of calls) {
        if (call.callee === targetFunc) {
          callers.push({
            caller,
            args: call.argValues,
            start: call.start,
            loc: call.loc
          });
        }
      }
    }

    return callers;
  }

  // 正向追踪：找到指定函数调用了谁
  findCallees(code, sourceFunc) {
    this.buildCallGraph(code);
    return this.callGraph.get(sourceFunc) || [];
  }

  // 构建完整调用链（从入口到目标）
  buildCallChain(code, targetFunc) {
    this.buildCallGraph(code);
    const chains = [];

    const dfs = (current, path, visited) => {
      if (visited.has(current)) return;
      visited.add(current);

      const calls = this.callGraph.get(current) || [];
      for (const call of calls) {
        const newPath = [...path, { from: current, to: call.callee, args: call.argValues }];

        if (call.callee === targetFunc) {
          chains.push(newPath);
        } else if (this.funcMap.has(call.callee)) {
          dfs(call.callee, newPath, new Set(visited));
        }
      }
    };

    // 从全局和所有入口开始
    dfs('__global__', [], new Set());
    for (const [funcName] of this.funcMap) {
      dfs(funcName, [], new Set());
    }

    return chains;
  }

  // 数据流分析：追踪变量在函数间的传递
  traceDataFlow(code, varName) {
    const ast = this.parse(code);
    const flow = [];

    traverse.default(ast, {
      VariableDeclarator: (path) => {
        const node = path.node;
        if (node.id.type === 'Identifier' && node.id.name === varName && node.init) {
          flow.push({
            type: 'declaration',
            value: this.code.slice(node.init.start, node.init.end),
            start: node.start,
            loc: node.loc
          });
        }
      },
      AssignmentExpression: (path) => {
        const node = path.node;
        const left = node.left.type === 'Identifier'
          ? node.left.name
          : this._getMemberPath(node.left);

        if (left === varName || left.startsWith(varName + '.')) {
          flow.push({
            type: 'assignment',
            target: left,
            value: this.code.slice(node.right.start, node.right.end),
            start: node.start,
            loc: node.loc
          });
        }
      },
      CallExpression: (path) => {
        const node = path.node;
        // 检查变量是否作为参数传递
        node.arguments.forEach((arg, idx) => {
          if (arg.type === 'Identifier' && arg.name === varName) {
            const callee = this._getCalleeName(node.callee);
            flow.push({
              type: 'passed-to',
              callee,
              argIndex: idx,
              start: node.start,
              loc: node.loc
            });
          }
        });
      }
    });

    return flow;
  }
}

export default CallStackAnalyzer;
