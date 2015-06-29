var Parser = extend(Object, {
    text: "",
    filename: "",
    length: 0,
    pos: 0,
    buffer: null,
    spaceStart: 0,
    spaceEnd: 0,
    hasLineTerminator: 0,
    
    __init__: function (text, filename) {
        this.text = text;
        this.filename = filename;
        this.length = text.length;
        this.pos = 0;
        this.spaceStart = 0;
        this.spaceEnd = 0;
        this.hasLineTerminator = 0;
        this.buffer = [];
    },
    
    m: function (type, start, obj) {
        obj = obj || {};
        obj.type = type;
        obj.filename = this.filename;
        obj.start = start;
        obj.end = obj.end || this.spaceStart;
        obj.text = this.text.substring(start, obj.end);
        return obj;
    },
    
    raise: function (msg) {
        raise(msg + " @" + this.pos);
    },
    
    matchCh: function (ch) {
        if (this.buffer.length > 0) {
            var t = this.buffer[0];
            if (t.type === 0 &&
                t.value === ch) {
                this.buffer.shift();
                this.restore(t.state);
                return 1;
            }
        } else {
            var l = ch.length;
            if (this.text.substr(this.pos, l) === ch) {
                this.pos += l;
                this.space();
                return 1;
            }
        }
        return 0;
    },
    
    expectCh: function (code) {
        this.matchCh(code) || this.raise("Expected " + String.fromCharCode(code));
    },
    
    peekMatch: function (ch) {
        if (this.buffer.length > 0) {
            var t = this.buffer[0];
            if (t.type === 0 &&
                t.value === ch) {
                return 1;
            }
        } else if (this.text.substr(this.pos, ch.length) === ch) {
            return 1;
        }
        return 0;
    },
    
    match: function (type, a, b) {
        var token = this.buffer.shift();
        if (!token) {
            return type(this, a, b);
        } else if (token.type === type) {
            this.restore(token.state);
            return token.value;
        } else if (!type.terminal) {
            this.buffer.unshift(token);
            return type(this, a, b);
        } else {
            return 0;
        }
    },
    
    expect: function (type, a, b) {
        return this.match(type, a, b) || this.raise("Expected " + type.name);
    },
    
    save: function (state) {
        state.pos = this.pos;
        state.spaceStart = this.spaceStart;
        state.spaceEnd = this.spaceEnd;
        state.hasLineTerminator = this.hasLineTerminator;
        return state;
    },
    
    restore: function (state) {
        this.pos = state.pos;
        this.spaceStart = state.spaceStart;
        this.spaceEnd = state.spaceEnd;
        this.hasLineTerminator = state.hasLineTerminator;
    },
    
    unget: function (type, value, state) {
        this.buffer.unshift({
            type: type,
            value: value,
            state: this.save({})
        });
        this.restore(state);
    },
    
    finished: function () {
        return this.buffer.length === 0 && this.pos >= this.length;
    },
    
    hasNewLine: function () {
        this.spaceEnd = this.pos && this.hasLineTerminator;
    },
    
    space: function () {
        this.spaceStart = this.pos;
        if (this.buffer.length === 0) {
            var ch = this.text.charCodeAt(this.pos);
            if (ch <= 32 || ch >= 160 || ch === 47) {
                this._space(ch);
            }
        }
    },

    _space: function (ch) {
        var p = this.pos,
        text = this.text,
        length = this.length;
        this.hasLineTerminator = 0;
        while (p < length) {
            if (ch === 32) ++p;
            else if (ch === 47) {
                ch = text.charCodeAt(p + 1);
                if (ch === 42) {
                    p = text.indexOf("*/", p + 2) + 2;
                    if (p === 1) this.raise("unterminated comment");
                } else if (ch === 47) {
                    ++p;
                    do ch = text.charCodeAt(++p);
                    while (p < length && ch !== 13 && ch !== 10 &&
                        ch !== 8232 && ch !== 8233);
                    this.hasLineTerminator = 1;
                    ++p;
                } else break;
            } else if (ch > 13 && ch < 160) break;
            else if (ch === 9) ++p;
            else if (ch === 13 || ch === 10 || ch === 8232 || ch === 8233) {
                this.hasLineTerminator = 1;
                ++p;
            } else if (ch === 11 || ch === 12 || ch === 160 ||
                (ch >= 5760 && nonASCIIwhitespace.test(text[p])))
                ++p;
            else break;
            ch = text.charCodeAt(p);
        }
        this.spaceEnd = this.pos = p;
    }
});

var terminal = function (fn) {
    fn.terminal = 1;
};

var D = function (o) { console.log(o); return o; };

function semicolon (p) {
    if (!p.matchCh(";") &&
        !(p.peekMatch("}") || p.hasNewLine() || p.finished()))
        return 0;
    return 1;
}

function SourceElements (p) {
    var stmts = [], l, stmt, pos = p.pos;
    stmt = p.match(Statement);
    while (stmt) {
        stmts.push(stmt);
        if (p.finished()) {
            break;
        }
        stmt = p.match(Statement);
    }
    var l = stmts.length;
    return l === 0? p.m(AST_EMPTY, pos):
        l === 1? stmts[0]:
        p.m(AST_BLOCK, pos, { stmts: stmts });
}

function Block (p) {
    var block = SourceElements(p);
    p.expectCh("}");
    return block;
}

function Statement(p) {
    var t, k, s = p.save({});
    if (t = p.match(Identifier)) {
        if (statementTableKeys[t] === 1)
            return p.match(statementTable[t]);
        k = p.peekMatch(":");
        p.unget(Identifier, t, s);
        return p.match(k? LabelledStatement: ExpressionStatement);
    }
    if (p.peekMatch("}")) return 0;
    if (p.matchCh("{")) return p.match(Block);
    if (p.matchCh(";")) return p.m(AST_EMPTY, s.pos);
    return p.match(ExpressionStatement);
}

function FunctionExpr(p) {
    var name = p.match(Identifier) || "",
    func = p.expect(FunctionLiteral);
    func.name = name;
    return func;
}

function FunctionDecl(p) {
    var func = p.expect(FunctionExpr);
    if (!func.name) p.raise("Expected function name");
    return func;
}

function FunctionLiteral(p) {
    var pos = p.pos, params = parseParams(p);
    p.expectCh("{");
    var body = p.expect(SourceElements);
    p.expectCh("}");
    return p.m(AST_FUNC, pos, {
        params: params,
        body: body
    });
};

var parseParams = function (p) {
    var params = [], id;
    p.expectCh("(");
    if (!p.matchCh(")")) {
        while (true) {
            id = p.expect(Identifier);
            checkId(id);
            params.push(id);
            if (p.matchCh(")")) break;
            p.expectCh(",");
        }
    }
    return params;
};

function Identifier(p) {
    var text = p.text, pos = p.pos, length = p.length,
        ch = text.charCodeAt(pos),
        p0 = pos, id;
    if (ch >= 97? ch <= 122: ch <= 90?
        ch >= 65 || ch === 36: ch === 95) {
        ch = text.charCodeAt(++pos);
        while (pos < length &&
            ch >= 97? ch <= 122: ch <= 90?
            ch >= 65 || (ch >= 48? ch <= 57: ch === 36): ch === 95)
            ch = text.charCodeAt(++pos);
        if (ch >= 0xaa) p.raise("nonASCII");
        else {
            id = text.substring(p0, pos);
            p.pos = pos;
            p.space();
            return id;
        }
    } else if (ch >= 0xaa) p.raise("nonASCII");
    else return 0;
}
terminal(Identifier);

var labelStmtTable = listToTable([AST_IF, AST_WHILE, AST_DO_WHILE, AST_FOR_IN, AST_FOR_LOOP, AST_BLOCK]);
function LabelledStatement (p) {
    var s = {}, labels = [], id = p.match(Identifier);
    while (id && p.matchCh(":")) {
        checkId(id);
        labels.push(id);
        p.save(s);
        id = p.match(Identifier);
    }
    if (id) p.unget(Identifier, id, s);
    var pos = p.pos;
    var stmt = p.expect(Statement);
    if (labelStmtTable[stmt.type]) {
        if (stmt.labels) {
            push.apply(stmt.labels, labels);
        } else {
            stmt.labels = labels;
        }
        return stmt;
    } else {
        return p.m(AST_BLOCK, pos, {
            stmts: [stmt],
            labels: labels
        });
    }
}

function ExpressionStatement (p) {
    var ret = p.expect(Expression);
    p.expect(semicolon);
    return ret;
}

function If (p) {
    var pos = p.spaceStart - 2, cond, sequent, alternate;
    p.expectCh("(");
    cond = p.expect(Expression);
    p.expectCh(")");
    sequent = p.expect(Statement);
    if (p.match(Identifier) === "else") {
        alternate = p.expect(Statement);
    } else {
        alternate = null;
    }
    return p.m(AST_IF, pos, {
        cond: cond,
        sequent: sequent,
        alternate: alternate,
    });
}

function While (p) {
    var pos = p.spaceStart - 5, cond, body;
    p.expectCh("(");
    cond = Expression(p);
    p.expectCh(")");
    body = p.expect(Statement);
    return p.m(AST_WHILE, pos, {
        cond: cond,
        body: body
    });
}

function DoWhile (p) {
    var pos = p.spaceStart - 2, cond, body;
    body = p.expect(Statement);
    p.expect(Identifier) === "while" || p.raise("Expected while");
    p.expectCh("(");
    cond = p.expect(Expression);
    p.expectCh(")");
    p.expect(semicolon);
    return p.m(AST_DO_WHILE, pos, {
        cond: cond,
        body: body
    });
}

function For (p) {
    var pos = p.spaceStart - 3, expr, s = p.save({}), s2, ret;
    expect("(");
    
    if (p.matchCh(";")) {
        p.unget(0, ";", s);
        ret = p.expect(ForLoop);
        ret.init = null;
        return p.m(AST_FOR_LOOP, pos, ret);
    }
    if (p.match(Identifier) === "var") {
        p.save(s);
        expr = p.expect(VarDecl, 1);
        s = p.save({});
        if (p.match(Identifier) === "in") {
            p.unget(Identifier, "in", s2);
            ret = p.expect(ForIn);
            ret.iterator = expr;
            return p.m(AST_FOR_IN, pos, ret);
        } else {
            p.unget(VarDecl, expr, s);
            expr = p.expect(VarDeclList, 1);
            ret = p.expect(ForLoop);
            ret.init = expr;
            return p.m(AST_FOR_LOOP, pos, ret);
        }
    } else {
        expr = p.expect(Expression, 0, 1);
        if (p.match(Identifier) === "in") {
            if (expr.type !== REFERENCE &&
                expr.type !== MEMBER)
                p.raise("Invalid lhs in for loop");
            ret = p.expect(ForIn);
            ret.iterator = expr;
            return p.m(AST_FOR_IN, pos, ret);
        } else {
            ret = p.expect(ForLoop);
            ret.init = expr;
            return p.m(AST_FOR_LOOP, pos, ret);
        }
    }
}

function ForIn (p) {
    var object = p.expect(Expression);
    p.expectCh(41);
    var body = p.expect(Statement);
    return {
        object: object,
        body: body
    };
}

function ForLoop (p) {
    var cond, update, body;
    p.expectCh(59);
    if (p.matchCh(59))
        cond = {
            type: CONSTANT,
            value: true
        };
    else {
        cond = p.expect(Expression);
        p.expect(59);
    }
    if (p.matchCh(41))
        update = null;
    else {
        update = p.expect(Expression);
        p.expectCh(41);
    }
    body = p.expect(Statement);
    return {
        cond: cond,
        update: update,
        body: body
    };
}

function Break (p) {
    var pos = p.spaceStart - 5, label = "";
    if (!p.hasNewLine()) {
        label = p.match(Identifier) || "";
    }
    p.expect(semicolon);
    return p.m(BREAK, pos, { label: label });
}

function Continue (p) {
    var pos = p.spaceStart - 8, label = "";
    if (!p.hasNewLine()) {
        label = p.match(Identifier) || "";
    }
    p.expect(semicolon);
    return p.m(CONTINUE, pos, { label: label });
}

function Return (p) {
    var value, pos = p.spaceStart - 6;
    if (p.peekMatch(";") || p.hasNewLine()) {
        value = {
            type: CONSTANT,
            value: undefined
        };
    } else {
        value = p.expect(Expression);
        p.expect(semicolon);
    }
    return p.m(RETURN, pos, { value: value });
}

function Throw (p) {
    var pos = p.spaceStart - 5;
    if (p.hasNewLine()) {
        p.raise("Expected expression");
    }
    var value = p.expect(Expression);
    p.expect(semicolon);
    return p.m(THROW, pos, { value: value });
}

function VarDeclList(p, noIn) {
    var pos = p.spaceStart - 3,
    list = [p.expect(VarDecl, noIn)];
    while (p.matchCh(",")) {
        list.push(p.expect(VarDecl, noIn));
    }
    return p.m(AST_VAR_DECL_LIST, pos, { decls: list });
}

function VarDecl(p, noIn) {
    var pos = p.pos, name, init = null;
    name = p.expect(Identifier);
    checkId(name);
    if (p.matchCh("=")) {
        init = p.expect(AssignmentExpression, noIn);
    }
    return p.m(AST_VAR_DECL, pos, {
        name: name,
        init: init
    });
}

function Debugger(p) {
    var pos = p.spaceStart - 8;
    p.expect(semicolon);
    return p.m(DEBUGGER, pos);
}

function NumericalLiteral(parser) {
    var text = parser.text,
    pos = parser.pos, p = pos,
    length = parser.length,
    ch, t, integerOrFraction = 0;
    ch = text.charCodeAt(pos);
    if (ch === 48) {
        ch = text.charCodeAt(++pos);
        if (ch === 88 || ch === 120) {
            do ch = text.charCodeAt(++pos);
            while (pos < length &&
                ((ch >= 48 && ch <= 57) ||
                (ch >= 65 && ch <= 70) ||
                (ch >= 97 && ch <= 102)));
            t = parseInt(text.substring(p, pos));
            parser.pos = pos;
            parser.space();
            return parser.m(CONSTANT, p, {
                value: t
            });
        }
        integerOrFraction = 1;
        ch = text.charCodeAt(pos);
    }
    
    if (ch >= 48 && ch <= 57) {
        integerOrFraction = 1;
        do ch = text.charCodeAt(++pos);
        while (pos < length && ch >= 48 && ch <= 57);
    }
    
    return NumericLiteral2(parser, pos, p, integerOrFraction);
}
terminal(NumericalLiteral);

function NumericLiteral2(parser, pos, p, integerOrFraction) {
    var text = parser.text,
    length = parser.length,
    ch = text.charCodeAt(pos), t;
    if (ch === 46) {
        ch = text.charCodeAt(++pos);
        if (ch >= 48 && ch <= 57) {
            do ch = text.charCodeAt(++pos);
            while (pos < length && ch >= 48 && ch <= 57);
        } else if (!integerOrFraction) return 0;
    } else if (!integerOrFraction) return 0;
    
    if (ch === 69 || ch === 101) {
        ch = text.charCodeAt(++pos);
        if (ch === 43 || ch === 45)
            ch = text.charCodeAt(++pos);
        if (ch >= 48 && ch <= 57)
            do ch = text.charCodeAt(++pos);
            while (pos < length && ch >= 48 && ch <= 57);
        else if (!integerOrFraction) return 0;
    }
    
    t = parseFloat(text.substring(p, pos));
    parser.pos = pos;
    parser.space();
    return parser.m(CONSTANT, p, {
        value: t
    });
}

var readHex = function (p) {
    var h = p.text.charCodeAt(++p.pos);
    if (h >= 48 && h <= 57) return h - 48;
    if (h >= 65 && h <= 70) return h - 55;
    if (h >= 97 && h <= 102) return h - 87;
    p.raise("Invalid hex digit '" + String.fromCharCode(h) + "'");
};

function StringLiteral(p) {
    var text = p.text, pos = p.pos, length = p.length,
    start = pos, ch, mark, s = [];
    mark = ch = text.charCodeAt(pos);
    if (ch !== 34 && ch !== 39) return 0;
    while (++pos < length) {
        ch = text.charCodeAt(pos);
        if (ch === mark) {
            p.pos = pos + 1;
            p.space();
            return p.m(CONSTANT, start, {
                value: s.join("")
            });
        } else if (ch === 92) {
            p.pos = pos;
            if (pos >= length) {
                p.raise("Unexpected end of string");
            }
            s.push(parseStringEscape(p));
        } else s.push(text.charAt(pos));
    }
    p.pos = pos;
    p.raise("Expected '\"'");
}
terminal(StringLiteral);

var parseStringEscape = function (p) {
    var ch = p.text.charCodeAt(++p.pos);
    if (ch < 117) {
        if (ch === 110) return "\n";
        if (ch === 116) return "\t";
        if (ch === 114) return "\r";
        if (ch === 48) return "\0";
        if (ch === 98) return "\b";
        if (ch === 102) return "\f";
    } else {
        if (ch === 120)
            return String.fromCharCode((readHex(p)<<4) | readHex(p));
        if (ch === 117)
            return String.fromCharCode((readHex(p)<<12) | (readHex(p)<<8) | (readHex(p)<<4) | readHex(p));
        if (ch !== 13 && ch !== 10 && ch !== 8232 || ch !== 8233)
            return p.text.charAt(p.pos);
        if (ch === 118) return "\v";
    }
};

function RegularExpression(p) {
    var text = p.text, pos = p.pos, length = p.length,
    ch, expr, flags, p0 = pos, p2, inClass = 0, escaped = 0;
    if (text.charCodeAt(pos++) !== 47) return 0;
    while (true) {
        ch = text.charCodeAt(pos);
        if (pos >= length || ch === 13 || ch === 10 || ch === 8232 || ch === 8233) {
            p.pos = pos;
            p.raise("Expected '/'");
        } else if (!escaped) {
            if (ch === 47 && !inClass) break;
            if (ch === 91) inClass = 1;
            else if (ch === 93  && inClass) inClass = 0;
            else if (ch === 92) escaped = 1;
        } else escaped = 0;
        pos++;
    }
    expr = text.substring(p0, pos);
    ch = text.charCodeAt(++pos);
    p2 = pos;
    while (pos < length &&
        (ch === 103 || ch === 105 || ch === 109 || ch === 115 || ch === 121)) {
        ch = text.charCodeAt(++pos);
    }
    flags = text.substring(p2, pos);
    p.pos = pos;
    p.space();
    return p.m(CONSTANT, p0, {
        value: new RegExp(expr, flags)
    });
}
terminal(RegularExpression);

function ArrayLiteral(p) {
    var pos = p.pos, array = [];
    if (!p.matchCh("[")) return 0;
    while (!p.finished()) {
        if (p.matchCh(",")) array.length++;
        else array.push(p.expect(AssignmentExpression));
        if (p.matchCh("]")) {
            return p.m(ARRAY_LITERAL, pos, { value: array });
        }
        p.expectCh(",");
    }
    p.raise("Expected ']'");
}

function ObjectLiteral(p) {
    var pos = p.pos, props = [], comma;
    if (!p.matchCh("{")) return 0;
    while (!p.finished()) {
        parseProperty(p, props);
        comma = p.matchCh(",");
        if (p.matchCh("}")) {
            return p.m(OBJECT_LITERAL, pos, { props: props });
        }
        comma || p.raise("Expected ','");
    }
    p.raise("expected '}'");
};

var parseProperty = function (p, props) {
    var pos = p.pos, v, id = p.match(Identifier);
    if ((id === "get" || id === "set") && !p.peekMatch(":")) {
        v = p.m(PROPERTY, pos, {
            key: p.match(Identifier) || parsePropertyName(p)
        });
        v[id] = p.expect(FunctionLiteral);
        props.push(v);
    } else {
        id = id || parsePropertyName(p);
        p.expectCh(":");
        props.push(p.m(PROPERTY, pos, {
            key: id,
            value: p.expect(AssignmentExpression)
        }));
        // inferFunctionName(v, id);
    }
};

var parsePropertyName = function (p) {
    var t;
    if (t = p.match(StringLiteral)) {
        return t.value;
    } else if (t = p.match(NumericalLiteral)) {
        return String(t.value);
    } else {
        p.raise("Expected property name");
    }
};

var parseArguments = function (p) {
    var args = [];
    if (p.match(",")) return args;
    while (!p.finished()) {
        args.push(p.expect(AssignmentExpression));
        if (p.matchCh(")")) return args;
        p.expectCh(",");
    }
    p.raise("expected ')'");
};

function AssignmentExpression(p, noIn) {
    var state = 1, lhs = 0, newPos = [],
        expr, op = 0, a, b, value, s = {},
        prefix = [], prefixPos = [], args,
        prevExpr, prevOp, precedence, prevPrecedence, stack = [];
    while (true) {
        p.save(s);
        if (value = p.match(Identifier)) {
            if (state) {
                if (keywordsAndReservedWordsAndBadIds[value] !== 1)
                    expr = p.m(REFERENCE, s.pos, { name: value });
                else if (value === "this")
                    expr = p.m(REFERENCE, s.pos, { name: "this" });
                else if (value === "true")
                    expr = p.m(CONSTANT, s.pos, { value: true });
                else if (value === "typeof")
                    op = 8;
                else if (value === "function") {
                    expr = p.expect(FunctionExpr);
                } else if (value === "null")
                    expr = p.m(CONSTANT, s.pos, { value: null });
                else if (value === "false")
                    expr = p.m(CONSTANT, s.pos, { value: false });
                else if (value === "new") {
                    lhs = 1;
                    newPos.push(s.pos);
                    continue;
                } else if (value === "delete")
                    op = 6;
                else if (value === "void")
                    op = 7;
                else p.raises(1);
            } else if (value === "instanceof")
                op = 27;
            else if (value === "in") {
                if (noIn) {
                    p.unget(Identifier, value, s);
                    op = 100;
                } else op = 28;
            } else op = 100;
        } else {
            if (state) {
                expr = p.match(StringLiteral) ||
                    p.match(NumericalLiteral) ||
                    p.match(ArrayLiteral) ||
                    p.match(ObjectLiteral) ||
                    p.match(RegularExpression);
                if (!expr) {
                    if (p.matchCh("(")) {
                        expr = p.expect(Expression);
                        p.expectCh(")");
                    } else if (p.matchCh("++")) {
                        op = 9;
                    } else if (p.matchCh("--")) {
                        op = 10;
                    } else if (p.matchCh("+")) {
                        op = 11;
                    } else if (p.matchCh("-")) {
                        op = 12;
                    } else if (p.matchCh("!")) {
                        op = 14;
                    } else if (p.matchCh("~")) {
                        op = 13;
                    } else {
                        p.raise(2);
                    }
                }
            } else {
                if (p.matchCh("(")) {
                    args = parseArguments(p);
                    if (newPos.length > 0)
                        expr = p.m(NEW, newPos.pop(), { func: expr, args: args });
                    else
                        expr = p.m(CALL, expr.start, { func: expr, args: args });
                } else if (p.matchCh("[")) {
                    expr = p.m(MEMBER, expr.start, {
                        obj: expr,
                        prop: p.expect(Expression)
                    });
                    p.expectCh("]");
                } else if (p.matchCh(".")) {
                    expr = p.m(MEMBER, expr.start, {
                        obj: expr,
                        prop: p.m(CONSTANT, p.pos, { value: p.expect(Identifier) })
                    });
                } else if (p.matchCh("&&")) {
                    op = 36;
                } else if (p.matchCh("&=")) {
                    op = 47;
                } else if (p.matchCh("&")) {
                    op = 33;
                } else if (p.matchCh("!==")) {
                    op = 32;
                } else if (p.matchCh("!=")) {
                    op = 30;
                } else if (p.matchCh("%=")) {
                    op = 41;
                } else if (p.matchCh("%")) {
                    op = 17;
                } else if (p.matchCh("++") && !p.hasNewLine()) {
                    op = 4;
                } else if (p.matchCh("+=")) {
                    op = 42;
                } else if (p.matchCh("+")) {
                    op = 18;
                } else if (p.matchCh("--") && !p.hasNewLine()) {
                    op = 5;
                } else if (p.matchCh("-=")) {
                    op = 43;
                } else if (p.matchCh("-")) {
                    op = 19;
                } else if (p.matchCh("*=")) {
                    op = 39;
                } else if (p.matchCh("*")) {
                    op = 15;
                } else if (p.matchCh("===")) {
                    op = 31;
                } else if (p.matchCh("==")) {
                    op = 29;
                } else if (p.matchCh("=")) {
                    op = 38;
                } else if (p.matchCh("<<=")) {
                    op = 44;
                } else if (p.matchCh("<<")) {
                    op = 20;
                } else if (p.matchCh("<=")) {
                    op = 25;
                } else if (p.matchCh("<")) {
                    op = 23;
                } else if (p.matchCh(">>>=")) {
                    op = 46;
                } else if (p.matchCh(">>>")) {
                    op = 22;
                } else if (p.matchCh(">>=")) {
                    op = 45;
                } else if (p.matchCh(">>")) {
                    op = 21;
                } else if (p.matchCh(">=")) {
                    op = 26;
                } else if (p.matchCh(">")) {
                    op = 24;
                } else if (p.matchCh("?")) {
                    op = 50;
                } else if (p.matchCh("||")) {
                    op = 37;
                } else if (p.matchCh("|=")) {
                    op = 49;
                } else if (p.matchCh("|")) {
                    op = 35;
                } else if (p.matchCh("^=")) {
                    op = 48;
                } else if (p.matchCh("^")) {
                    op = 34;
                } else if (p.matchCh("/=")) {
                    op = 40;
                } else if (p.matchCh("/")) {
                    op = 16;
                } else {
                    op = 100;
                }
            }
        }
        if (op === 0) {
            state = 0;
            lhs = 0;
            continue;
        }
        while (newPos.length > 0)
            expr = p.m(NEW, newPos.pop(), {
                end: s.spaceStart,
                func: expr,
                args: []
            });
        if (op >= 6 && op <= 14) {
            lhs && p.raise("Unexpected token");
            prefix.push(op);
            prefixPos.push(s.pos);
        } else {
            if (op >= 15) {
                while (prefix.length > 0)
                    expr = p.m(UNARY, prefixPos.pop(), {
                        operator: prefix.pop(),
                        operand: expr
                    });
                
                precedence = precedenceTable[op];
                if (precedence === 12) {
                    if (expr.type !== REFERENCE &&
                        expr.type !== MEMBER) {
                        p.raise("Invalid left-hand side in assignment");
                    }
                } else {
                    while (prevPrecedence <= precedence) {
                        if (prevOp === 38) {
                            expr = p.m(ASSIGN, prevExpr.start, {
                                end: s.spaceStart,
                                lhs: prevExpr,
                                rhs: expr
                            });
                        } else if (prevOp >= 39 && prevOp <= 49) {
                            expr = p.m(COMPOUND_ASSIGN, prevExpr.start, {
                                end: s.spaceStart,
                                operator: prevOp,
                                lhs: prevExpr,
                                rhs: expr
                            });
                        } else {
                            expr = p.m(BINARY, prevExpr.start, {
                                end: s.spaceStart,
                                operator: prevOp,
                                first: prevExpr,
                                second: expr
                            });
                        }
                        prevPrecedence = stack.pop();
                        prevOp = stack.pop();
                        prevExpr = stack.pop();
                    }
                    if (op === 100) return expr;
                    if (op === 50) {
                        a = p.expect(AssignmentExpression, noIn);
                        p.expectCh(":");
                        b = p.expect(AssignmentExpression, noIn);
                        expr = p.m(AST_IF, expr.start, {
                            cond: expr,
                            sequent: a,
                            alternate: b
                        });
                        op = 0;
                        continue;
                    }
                }
                prevOp && stack.push(prevExpr, prevOp, prevPrecedence);
                prevExpr = expr;
                prevOp = op;
                prevPrecedence = precedence;
                state = 1;
            } else expr = p.m(UNARY, expr.start, { operator: op, operand: expr });
        }
        op = 0;
    }
};

function Expression (p, noIn) {
    var list, expr = p.match(AssignmentExpression, noIn);
    if (!expr) return 0;
    if (p.matchCh(",")) {
        list = [expr];
        do list.push(p.expect(AssignmentExpression, noIn));
        while (p.matchCh(","));
        return { type: EXPR_LIST, list: list };
    } else return expr;
}

function Try(p) {
    var hasTry = 0, s, pos = p.spaceStart - 3;
    p.expectCh("{");
    var n = {
        tryBlock: p.expect(Block)
    };
    var id = p.match(Identifier);
    if (id === "catch") {
        p.expectCh("(");
        n.exception = p.expect(Identifier);
        p.expectCh("{");
        n.catchBlock = p.expect(Block);
        hasTry = 1;
        s = p.save({});
        id = p.match(Identifier);
    } else n.catchBlock = null;
    
    if (id === "finally") {
        p.expectCh("{");
        n.finallyBlock = p.expect(Block);
    } else if (hasTry) {
        if (id) p.unget(Identifier, id, s);
        n.finallyBlock = null;
    } else {
        p.raise("Expected catch or finally");
    }
    
    return p.m(AST_TRY, pos, n);
}

function With(p) {
    var pos = p.spaceStart - 4;
    p.expectCh("(");
    var obj = p.expect(Expression);
    p.expectCh(")");
    var body = p.expect(Statement);
    return p.m(AST_WITH, pos, {
        obj: obj,
        body: body
    });
}

function Switch(p) {
    var pos = p.spaceStart - 6;
    p.expectCh("(");
    var obj = p.expect(Expression);
    p.expectCh("{");
    var cases = [], theCase = 0, newCase, id, s = {};
    while (!p.matchCh("}")) {
        p.save(s);
        id = p.match(Identifier);
        if (id === "case") {
            newCase = {
                isDefault: false,
                value: p.expect(Expression)
            };
            p.expectCh(":");
        } else if (id === "default") {
            newCase = {
                isDefault: true
            };
            p.expectCh(":");
        } else if (theCase === 0) {
            p.raise("Expected case or default");
        } else {
            if (id) p.unget(Identifier, id, s);
            theCase.body.push(p.expect(Statement));
            continue;
        }
        if (theCase) cases.push(theCase);
        theCase = newCase;
        theCase.body = [];
    }
    if (theCase) cases.push(theCase);
    return p.m(AST_SWITCH, pos, {
        obj: obj,
        cases: cases
    });
}

var statementTable = {
    "if": If,
    "for": For,
    "while": While,
    "do": DoWhile,
    "switch": Switch,
    "try": Try,
    "with": With,
    "var": VarDeclList,
    "return": Return,
    "throw": Throw,
    "break": Break,
    "continue": Continue,
    "debugger": Debugger,
    "function": FunctionDecl
};

var statementTableKeys = {
    "if": 1,
    "for": 1,
    "while": 1,
    "do": 1,
    "switch": 1,
    "try": 1,
    "with": 1,
    "var": 1,
    "return": 1,
    "throw": 1,
    "break": 1,
    "continue": 1,
    "debugger": 1,
    "function": 1
};

var Parse = function (text, filename) {
    var parser = new Parser(text, filename || "[code " + (++Parse.sourceCounter) + "]");
    var body = parser.expect(SourceElements);
    return parser.m(AST_PROGRAM, 0, { body: body });
};

Parse.sourceCounter = 0;
