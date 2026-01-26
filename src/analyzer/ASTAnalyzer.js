/**
 * JSForge - AST 分析器
 */

import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export class ASTAnalyzer {
  parse(code) {
    try {
      return acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'script',
        allowHashBang: true
      });
    } catch (e) {
      // 尝试 module 模式
      return acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'module'
      });
    }
  }

  extractFunctions(code) {
    const ast = this.parse(code);
    const functions = [];

    walk.simple(ast, {
      FunctionDeclaration(node) {
        functions.push({
          type: 'declaration',
          name: node.id?.name || 'anonymous',
          params: node.params.map(p => p.name || 'param'),
          start: node.start,
          end: node.end
        });
      },
      FunctionExpression(node) {
        functions.push({
          type: 'expression',
          name: node.id?.name || 'anonymous',
          params: node.params.map(p => p.name || 'param'),
          start: node.start,
          end: node.end
        });
      },
      ArrowFunctionExpression(node) {
        functions.push({
          type: 'arrow',
          name: 'arrow',
          params: node.params.map(p => p.name || 'param'),
          start: node.start,
          end: node.end
        });
      }
    });

    return functions;
  }

  extractCalls(code) {
    const ast = this.parse(code);
    const calls = [];

    walk.simple(ast, {
      CallExpression(node) {
        let name = '';
        if (node.callee.type === 'Identifier') {
          name = node.callee.name;
        } else if (node.callee.type === 'MemberExpression') {
          name = this._getMemberPath(node.callee);
        }
        calls.push({
          name,
          args: node.arguments.length,
          start: node.start
        });
      }
    });

    return calls;
  }

  _getMemberPath(node) {
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'MemberExpression') {
      const obj = this._getMemberPath(node.object);
      const prop = node.property.name || node.property.value;
      return `${obj}.${prop}`;
    }
    return '';
  }
}

export default ASTAnalyzer;
