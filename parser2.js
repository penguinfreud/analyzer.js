iter = 0;
var TOKEN_ID = ++iter,
TOKEN_NUMBER = ++iter,
TOKEN_STRING = ++iter,
TOKEN_REGEXP = ++iter,
TOKEN_OP = ++iter,
TOKEN_PUNC = ++iter,
TOKEN_EOF = ++iter;

var _puncs = listToTable([44, 46, 58, 59, 40, 41, 91, 93, 123, 125]);
var _notAllowRegExp = listToTable(["this", "true", "false", "null", 46, 41, 93, 125]);
var _hashOpTable = {}, _hashOpConfirm = {};
function _hashOp(a, b, c) {
    var h = a;
    h += h << 10;
    h ^= h >> 6;
    h += b;
    h += h << 10;
    h ^= h >> 6;
    h += c;
    h += h << 10;
    h ^= h >> 6;
    return h % 370;
}

["++", "--", "<<", ">>", ">>>", "<=", ">=", "==", "!=", "===", "!==", "&&", "||", "*=", "/=", "%=", "+=", "-=", "<<=", ">>=", "&=", "^=", "|=", "+", "-", "*", "/", "%", "~", "!", "<", ">", "=", "&", "^", "|", "?"]
.forEach(function (s) {
    var a = s.charCodeAt(0),
    b = s.charCodeAt(1) || 32,
    c = s.charCodeAt(2) || 32,
    h = _hashOp(a, b, c), op;
    if (s === "++") {
        op = 4;
    } else if (s === "--") {
        op = 5;
    } else {
        op = opTable[s];
    }
    _hashOpConfirm[s] = 1;
    if (_hashOpTable[h]) console.log("clash");
    _hashOpTable[h] = op;
});

var Lexer = extend(Object, {
    text: "",
    filename: "",
    pos: 0,
    length: 0,
    spaceStart: 0,
    spaceEnd: 0,
    hasLineTerminator: 0,
    tokenStart: 0,
    notAllowRegExp: 0,
    
    __init__: function (text, filename) {
        this.text = text;
        this.filename = filename || "[code " + (++Lexer.sourceCounter) + "]";
        this.pos = 0;
        this.length = text.length;
        this.spaceStart = 0;
        this.spaceEnd = 0;
        this.hasLineTerminator = 0;
        this.tokenStart = 0;
        this.notAllowRegExp = 0;
    },
    
    raise: function (msg) {
        raise(msg + " @" + this.pos);
    },
    
    next: function (forceRegExp) {
        var text = this.text, pos = this.pos, ch = text.charCodeAt(pos),
        op = 0, l, a, b, h;
        this.tokenStart = this.pos;
        if (pos >= this.length) return this.make(TOKEN_EOF, undefined);
        if (ch >= 97? ch <= 122: ch <= 90?
            ch >= 65 || ch === 36: ch === 95) {
            return this.identifier();
        } else if (ch === 34 || ch === 39) {
            return this.string(ch);
        } else if (ch >= 48 && ch <= 57 || ch === 46) {
            return this.number(ch);
        } else if (ch === 47) {
            if (this.notAllowRegExp && !forceRegExp) {
                this.notAllowRegExp = 0;
                if (text.charCodeAt(pos + 1) === 61) {
                    op = 40;
                    l = 2;
                } else {
                    op = 16;
                    l = 1;
                }
            } else {
                return this.regexp();
            }
        } else if (_puncs[ch]) {
            this.pos++;
            this.space();
            this.notAllowRegExp = _notAllowRegExp[ch];
            return this.make(TOKEN_PUNC, ch);
        } else if (ch === 63) {
            op = 50;
            l = 1;
        } else if (ch >= 0xaa) {
            this.raise("nonASCII");
        } else if (ch) {
            this.notAllowRegExp = 0;
            a = text.charCodeAt(pos + 1);
            b = text.charCodeAt(pos + 2);
            h = _hashOp(ch, a, b);
            if ((op = _hashOpTable[h]) && _hashOpConfirm[text.substr(pos, 3)]) {
                if (op === 22 && text.charCodeAt(pos + 3) === 61) {
                    op = 46;
                    l = 4;
                } else {
                    l = 3;
                }
            } else {
                h = _hashOp(ch, a, 32);
                if ((op = _hashOpTable[h]) && _hashOpConfirm[text.substr(pos, 2)]) {
                    l = 2;
                    if (op === 4 || op === 5) {
                        this.notAllowRegExp = 1;
                    }
                } else {
                    op = opTable[text.charAt(pos)];
                    l = 1;
                }
            }
        }
        
        if (op) {
            this.pos += l;
            this.space();
            return this.make(TOKEN_OP, op);
        }
        
        this.raise("Unexpected token");
    },
    
    make: function (type, value) {
        return {
            type: type,
            value: value,
            start: this.tokenStart,
            end: this.spaceStart,
            hasNewLine: this.spaceEnd === this.pos && this.hasLineTerminator
        };
    },
    
    space: function () {
        this.spaceStart = this.pos;
        var ch = this.text.charCodeAt(this.pos);
        if (ch <= 32 || ch >= 160 || ch === 47) {
            this._space(ch);
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
    },
    
    identifier: function () {
        var text = this.text, pos = this.pos, length = this.length,
            ch, id;
        ch = text.charCodeAt(++pos);
        while (pos < length &&
            ch >= 97? ch <= 122: ch <= 90?
            ch >= 65 || (ch >= 48? ch <= 57: ch === 36): ch === 95)
            ch = text.charCodeAt(++pos);
        if (ch >= 0xaa) this.raise("nonASCII");
        else {
            id = text.substring(this.tokenStart, pos);
            this.pos = pos;
            this.space();
            this.notAllowRegExp = !keywordsAndReservedWordsAndBadIds[id] || _notAllowRegExp[id];
            return this.make(TOKEN_ID, id);
        }
    },
    
    number: function (ch) {
        var text = this.text, pos = this.pos, length = this.length,
        t, integerOrFraction = 0;
        
        if (ch === 48) {
            ch = text.charCodeAt(++pos);
            if (ch === 88 || ch === 120) {
                do ch = text.charCodeAt(++pos);
                while (pos < length &&
                    ((ch >= 48 && ch <= 57) ||
                    (ch >= 65 && ch <= 70) ||
                    (ch >= 97 && ch <= 102)));
                t = parseInt(text.substring(this.tokenStart, pos));
                this.pos = pos;
                this.space();
                this.notAllowRegExp = 1;
                return this.make(TOKEN_NUMBER, t);
            }
            integerOrFraction = 1;
            ch = text.charCodeAt(pos);
        }
        
        if (ch >= 48 && ch <= 57) {
            integerOrFraction = 1;
            do ch = text.charCodeAt(++pos);
            while (pos < length && ch >= 48 && ch <= 57);
        }
        
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
        
        t = parseFloat(text.substring(this.tokenStart, pos));
        this.pos = pos;
        this.space();
        this.notAllowRegExp = 1;
        return this.make(TOKEN_NUMBER, t);
    },
    
    string: function (mark) {
        var text = this.text, pos = this.pos, length = this.length,
        ch, s = [];
        while (++pos < length) {
            ch = text.charCodeAt(pos);
            if (ch === mark) {
                this.pos = pos + 1;
                this.space();
                this.notAllowRegExp = 1;
                return this.make(TOKEN_STRING, s.join(""));
            } else if (ch === 92) {
                this.pos = pos;
                if (pos >= length) this.raise("Unexpected end of string");
                s.push(this.parseStringEscape());
            } else s.push(text.charAt(pos));
        }
        this.pos = pos;
        this.raise("Expected '\"'");
    },
    
    parseStringEscape: function () {
        var ch = this.text.charCodeAt(++this.pos);
        if (ch < 117) {
            if (ch === 110) return "\n";
            if (ch === 116) return "\t";
            if (ch === 114) return "\r";
            if (ch === 48) return "\0";
            if (ch === 98) return "\b";
            if (ch === 102) return "\f";
        } else {
            if (ch === 120)
                return String.fromCharCode((this._readHex()<<4) | this._readHex());
            if (ch === 117)
                return String.fromCharCode((this._readHex()<<12) | (this._readHex()<<8) | (this._readHex()<<4) | this._readHex());
            if (ch !== 13 && ch !== 10 && ch !== 8232 || ch !== 8233)
                return p.text.charAt(p.pos);
            if (ch === 118) return "\v";
        }
    },
    
    _readHex: function () {
        var h = this.text.charCodeAt(++this.pos);
        if (h >= 48 && h <= 57) return h - 48;
        if (h >= 65 && h <= 70) return h - 55;
        if (h >= 97 && h <= 102) return h - 87;
        this.raise("Invalid hex digit '" + String.fromCharCode(h) + "'");
    },
    
    regexp: function () {
        var text = this.text, pos = this.pos, length = this.length,
        ch, expr, flags, p2, inClass = 0, escaped = 0;
        while (true) {
            ch = text.charCodeAt(++pos);
            if (pos >= length || ch === 13 || ch === 10 || ch === 8232 || ch === 8233) {
                this.pos = pos;
                this.raise("Expected '/'");
            } else if (!escaped) {
                if (ch === 47 && !inClass) break;
                if (ch === 91) inClass = 1;
                else if (ch === 93  && inClass) inClass = 0;
                else if (ch === 92) escaped = 1;
            } else escaped = 0;
        }
        expr = text.substring(this.tokenStart, pos);
        ch = text.charCodeAt(++pos);
        p2 = pos;
        while (pos < length &&
            (ch === 103 || ch === 105 || ch === 109 || ch === 115 || ch === 121)) {
            ch = text.charCodeAt(++pos);
        }
        flags = text.substring(p2, pos);
        this.pos = pos;
        this.space();
        this.notAllowRegExp = 1;
        return this.make(TOKEN_REGEXP, new RegExp(expr, flags));
    }
});

Lexer.sourceCounter = 0;

var Parser = extend(Object, {
    lexer: null,
    buffer: null,
    filename: "",
    last: null,
    
    __init__: function (lexer) {
        this.lexer = lexer;
        this.buffer = [];
        this.filename = lexer.filename;
        this.last = null;
    },
    
    next: function (forceRegExp) {
        return this.last = this.buffer.shift() || this.lexer.next(forceRegExp);
    },
    
    peek: function (forceRegExp, depth) {
        var buf = this.buffer, tok, i = buf.length;
        if (!depth) depth = 1;
        if (i < depth) {
            buf.push(this.lexer.next(forceRegExp));
            if (i + 1 < depth) this.raise("Peeking too far");
        }
        return buf[depth - 1];
    },
    
    raise: function (msg) {
        this.lexer.raise(msg);
    },
    
    match: function (code) {
        var token = this.peek();
        if (token.type === TOKEN_PUNC && token.value === code) {
            this.next();
            return token;
        }
        return 0;
    },
    
    expect: function (code) {
        var token = this.next();
        if (token.type !== TOKEN_PUNC || token.value !== code)
            this.raise("Expected '" + String.fromCharCode(code) + "'");
    },
    
    peekMatch: function (code, depth) {
        var token = this.peek(false, depth);
        return token.type === TOKEN_PUNC && token.value === code;
    },
    
    ident: function () {
        var token = this.peek();
        if (token.type === TOKEN_ID) {
            this.next();
            return token.value;
        }
        return 0;
    },
    
    expectIdent: function () {
        var token = this.next();
        if (token.type === TOKEN_ID)
            return token.value;
        this.raise("Expected identifier");
    },
    
    matchIdent: function (id) {
        var token = this.peek();
        if (token.type === TOKEN_ID && token.value === id) {
            this.next();
            return 1;
        }
        return 0;
    },
    
    finished: function () {
        return this.buffer.length === 0?
            this.lexer.pos >= this.lexer.length:
            this.buffer[0].type === TOKEN_EOF;
    },
    
    make: function (type, start, obj) {
        obj.filename = this.filename;
        obj.start = start;
        obj.end = obj.end || (this.last? this.last.end: this.pos());
        obj.text = this.lexer.text.substring(start, obj.end);
        obj.type = type;
        if (!obj) debugger;
        return obj;
    },
    
    pos: function () {
        if (this.buffer.length > 0)
            return this.buffer[0].start;
        return this.lexer.pos;
    }
});

function semicolon (p) {
    if (p.match(59)) {
        return 1;
    } else {
        var token = p.peek();
        if (token.type === TOKEN_PUNC && token.value === 125 ||
            token.hasNewLine ||
            p.finished()) {
            return 1;
        }
    }
    return 0;
}

function SourceElements(p) {
    var pos = p.pos(), stmts = [], l;
    while (!p.finished() && !p.peekMatch(125)) {
        stmts.push(Statement(p));
    }
    var l = stmts.length;
    return l === 0? p.make(AST_EMPTY, pos, {}):
        l === 1? stmts[0]:
        p.make(AST_BLOCK, pos, { stmts: stmts });
}

function Block (p) {
    var block = SourceElements(p);
    p.expect(125);
    return block;
}

function Statement(p) {
    var pos = p.pos(), t = p.peek(true);
    if (t.type === TOKEN_ID) {
        if (statementTableKeys[t.value] === 1) {
            p.next();
            return statementTable[t.value](p, pos);
        }
        if (p.peekMatch(58, 2)) {
            return LabelledStatement(p, pos);
        }
    } else if (t.type === TOKEN_PUNC) {
        if (t.value === 59) {
            p.next();
            return p.make(AST_EMPTY, pos, {});
        } else if (t.value === 123) {
            p.next();
            return Block(p);
        }
    }
    return ExpressionStatement(p);
}

function FunctionExpr(p, pos) {
    var name = p.ident() || "";
    func = FunctionLiteral(p, pos);
    func.name = name;
    return func;
}

function FunctionDecl(p, pos) {
    var func = FunctionExpr(p, pos);
    if (!func.name) p.raise("Expected function name");
    return func;
}

function FunctionLiteral(p, pos) {
    var params = parseParams(p);
    p.expect(123);
    var body = SourceElements(p);
    p.expect(125);
    return p.make(AST_FUNC, pos, {
        params: params,
        body: body
    });
};

var parseParams = function (p) {
    var params = [], id;
    p.expect(40);
    if (!p.match(41)) {
        while (true) {
            id = p.expectIdent();
            checkId(id);
            params.push(id);
            if (p.match(41)) break;
            p.expect(44);
        }
    }
    return params;
};

var labelStmtTable = listToTable([AST_IF, AST_WHILE, AST_DO_WHILE, AST_FOR_IN, AST_FOR_LOOP, AST_BLOCK]);
function LabelledStatement (p, pos) {
    var token, labels = [], token = p.peek();
    while (token.type === TOKEN_ID && p.peekMatch(58, 2)) {
        p.next();
        p.next();
        checkId(token.value);
        labels.push(token.value);
        token = p.peek();
    }
    var stmt = Statement(p);
    if (labelStmtTable[stmt.type]) {
        if (stmt.labels) {
            push.apply(stmt.labels, labels);
        } else {
            stmt.labels = labels;
        }
        return stmt;
    } else {
        return p.make(AST_BLOCK, pos, {
            stmts: [stmt],
            labels: labels
        });
    }
}

function ExpressionStatement (p) {
    var ret = Expression(p);
    semicolon(p);
    return ret;
}

function If (p, pos) {
    var cond, sequent, alternate;
    p.expect(40);
    cond = Expression(p);
    p.expect(41);
    sequent = Statement(p);
    if (p.matchIdent("else")) {
        alternate = Statement(p);
    } else {
        alternate = null;
    }
    return p.make(AST_IF, pos, {
        cond: cond,
        sequent: sequent,
        alternate: alternate,
    });
}

function While (p, pos) {
    var cond, body;
    p.expect(40);
    cond = Expression(p);
    p.expect(41);
    body = Statement(p);
    return p.make(AST_WHILE, pos, {
        cond: cond,
        body: body
    });
}

function DoWhile (p, pos) {
    var cond, body;
    body = Statement(p);
    p.matchIdent("while") || p.raise("Expected while");
    p.expect(40);
    cond = Expression(p);
    p.expect(41);
    semicolon(p);
    return p.make(AST_DO_WHILE, pos, {
        cond: cond,
        body: body
    });
}

function For (p, pos) {
    var expr, list, p2, ret;
    p.expect(40);
    
    if (p.match(59)) {
        ret = ForLoop(p);
        ret.init = null;
        return p.make(AST_FOR_LOOP, pos, ret);
    }
    p2 = p.pos();
    if (p.matchIdent("var")) {
        expr = VarDecl(p, 1);
        if (p.matchIdent("in")) {
            ret = ForIn(p);
            ret.iterator = expr;
            return p.make(AST_FOR_IN, pos, ret);
        } else {
            list = [expr];
            while (p.match(44)) {
                list.push(VarDecl(p, 1));
            }
            p.expect(59);
            expr = p.make(AST_VAR_DECL_LIST, p2, { decls: list });
            ret = ForLoop(p);
            ret.init = expr;
            return p.make(AST_FOR_LOOP, pos, ret);
        }
    } else {
        expr = Expression(p, 1);
        if (p.matchIdent("in")) {
            if (expr.type !== REFERENCE &&
                expr.type !== MEMBER)
                p.raise("Invalid lhs in for loop");
            ret = ForIn(p);
            ret.iterator = expr;
            return p.make(AST_FOR_IN, pos, ret);
        } else {
            ret = ForLoop(p);
            ret.init = expr;
            return p.make(AST_FOR_LOOP, pos, ret);
        }
    }
}

function ForIn (p) {
    var object = Expression(p);
    p.expect(41);
    var body = Statement(p);
    return {
        object: object,
        body: body
    };
}

function ForLoop (p) {
    var cond, update, body;
    if (p.match(59))
        cond = {
            type: CONSTANT,
            value: true
        };
    else {
        cond = Expression(p);
        p.expect(59);
    }
    if (p.match(41))
        update = null;
    else {
        update = Expression(p);
        p.expect(41);
    }
    body = Statement(p);
    return {
        cond: cond,
        update: update,
        body: body
    };
}

function Break(p, pos) {
    var label = "";
    if (!p.peek().hasNewLine) {
        label = p.ident() || "";
    }
    semicolon(p);
    return p.make(BREAK, pos, { label: label });
}

function Continue (p, pos) {
    var label = "";
    if (!p.peek().hasNewLine) {
        label = p.ident() || "";
    }
    semicolon(p);
    return p.make(CONTINUE, pos, { label: label });
}

function Return (p, pos) {
    var value;
    if (p.match(59) || p.peek(true).hasNewLine) {
        value = {
            type: CONSTANT,
            value: undefined
        };
    } else {
        value = Expression(p);
        semicolon(p);
    }
    return p.make(RETURN, pos, { value: value });
}

function Throw (p, pos) {
    if (p.peek(true).hasNewLine)
        p.raise("Expected expression");
    var value = Expression(p);
    semicolon(p);
    return p.make(THROW, pos, { value: value });
}

function VarDeclList(p, pos) {
    var list = [VarDecl(p)];
    while (p.match(44)) {
        list.push(VarDecl(p));
    }
    semicolon(p);
    return p.make(AST_VAR_DECL_LIST, pos, { decls: list });
}

function VarDecl(p, noIn) {
    var pos = p.pos(), name, init = null;
    name = p.expectIdent();
    checkId(name);
    if (p.match(61)) {
        init = AssignmentExpression(p, noIn);
    }
    return p.make(AST_VAR_DECL, pos, {
        name: name,
        init: init
    });
}

function Debugger(p, pos) {
    semicolon(p);
    return p.make(DEBUGGER, pos);
}

function ArrayLiteral(p) {
    var pos = p.pos(), array = [];
    if (!p.match(91)) return 0;
    while (!p.finished()) {
        if (p.match(44)) array.length++;
        else array.push(AssignmentExpression(p));
        if (p.match(93))
            return p.make(ARRAY_LITERAL, pos, { value: array });
        p.expect(44);
    }
    p.raise("Expected ']'");
}

function ObjectLiteral(p) {
    var pos = p.pos(), props = [], comma;
    if (!p.match(123)) return 0;
    while (!p.finished()) {
        parseProperty(p, props);
        comma = p.match(44);
        if (p.match(125)) {
            return p.make(OBJECT_LITERAL, pos, { props: props });
        }
        comma || p.raise("Expected ','");
    }
    p.raise("expected '}'");
};

var parseProperty = function (p, props) {
    var pos = p.pos(), v, id = p.ident();
    if ((id === "get" || id === "set") && !p.peekMatch(58)) {
        v = p.make(PROPERTY, pos, {
            key: parsePropertyName(p)
        });
        v[id] = FunctionLiteral(p, pos);
        props.push(v);
    } else {
        id = id || parsePropertyName(p);
        p.expect(58);
        props.push(p.make(PROPERTY, pos, {
            key: id,
            value: AssignmentExpression(p)
        }));
        // inferFunctionName(v, id);
    }
};

var parsePropertyName = function (p) {
    var token = p.next();
    if (token.type === TOKEN_ID || token.type === TOKEN_STRING)
        return token.value;
    else if (token.type === TOKEN_NUMBER)
        return String(token.value);
    else
        p.raise("Expected property name");
};

var parseArguments = function (p) {
    var args = [];
    if (p.match(44)) return args;
    while (!p.finished()) {
        args.push(AssignmentExpression(p));
        if (p.match(41)) return args;
        p.expect(44);
    }
    p.raise("expected ')'");
};

function AssignmentExpression(p, noIn) {
    var state = 1, lhs = 0, newPos = [],
        expr, op = 0, a, b, value, pos, token,
        prefix = [], prefixPos = [], args,
        prevExpr, prevOp, precedence, prevPrecedence, stack = [];
    while (true) {
        pos = p.pos();
        token = p.peek();
        value = token.value;
        if (token.type === TOKEN_ID) {
            if (state) {
                p.next();
                if (keywordsAndReservedWordsAndBadIds[value] !== 1)
                    expr = p.make(REFERENCE, pos, { name: value });
                else if (value === "this")
                    expr = p.make(REFERENCE, pos, { name: "this" });
                else if (value === "true")
                    expr = p.make(CONSTANT, pos, { value: true });
                else if (value === "typeof")
                    op = 8;
                else if (value === "function") {
                    expr = p.expect(FunctionExpr);
                } else if (value === "null")
                    expr = p.make(CONSTANT, pos, { value: null });
                else if (value === "false")
                    expr = p.make(CONSTANT, pos, { value: false });
                else if (value === "new") {
                    lhs = 1;
                    newPos.push(pos);
                    continue;
                } else if (value === "delete")
                    op = 6;
                else if (value === "void")
                    op = 7;
                else p.raises(1);
            } else if (value === "instanceof") {
                op = 27;
                p.next();
            } else if (value === "in") {
                if (noIn) {
                    op = 100;
                } else {
                    p.next();
                    op = 28;
                }
            } else {
                op = 100;
            }
        } else {
            if (state) {
                if (token.type === TOKEN_STRING ||
                    token.type === TOKEN_NUMBER ||
                    token.type === TOKEN_REGEXP) {
                    p.next();
                    expr = p.make(CONSTANT, token.start, token);
                } else if (token.type === TOKEN_PUNC) {
                    expr = ArrayLiteral(p) || ObjectLiteral(p);
                    if (!expr) {
                        if (value === 40) {
                            expr = Expression(p);
                            p.expect(41);
                        } else p.raise("Invalid");
                    }
                } else if (token.type === TOKEN_OP) {
                    p.next();
                    if (value === 4) op = 9;
                    else if (value === 5) op = 10;
                    else op = value;
                } else p.raise("Invalid");
            } else {
                if (token.type === TOKEN_PUNC) {
                    if (value === 40) {
                        p.next();
                        args = parseArguments(p);
                        expr = { func: expr, args: args };
                        if (newPos.length > 0)
                            p.make(NEW, newPos.pop(), expr);
                        else
                            p.make(CALL, expr.func.start, expr);
                    } else if (value === 91) {
                        p.next();
                        expr = p.make(MEMBER, expr.start, {
                            obj: expr,
                            prop: Expression(p)
                        });
                        p.expect(93);
                    } else if (value === 46) {
                        p.next();
                        token = p.next();
                        if (token.type !== TOKEN_ID)
                            p.raise("Expected identifier");
                        expr = p.make(MEMBER, expr.start, {
                            obj: expr,
                            prop: p.make(CONSTANT, token.start, token)
                        });
                    } else op = 100;
                } else if (token.type === TOKEN_OP) {
                    if ((value === 4 || value === 5) && token.hasNewLine)
                        op = 100;
                    else {
                        p.next();
                        op = value;
                    }
                } else op = 100;
            }
        }
        if (op === 0) {
            state = 0;
            lhs = 0;
            continue;
        }
        while (newPos.length > 0)
            expr = p.make(NEW, newPos.pop(), {
                end: pos,
                func: expr,
                args: []
            });
        if (op >= 6 && op <= 14) {
            lhs && p.raise("Unexpected token");
            prefix.push(op);
            prefixPos.push(pos);
        } else {
            if (op >= 15) {
                while (prefix.length > 0)
                    expr = p.make(UNARY, prefixPos.pop(), {
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
                            expr = p.make(ASSIGN, prevExpr.start, {
                                end: pos,
                                lhs: prevExpr,
                                rhs: expr
                            });
                        } else if (prevOp >= 39 && prevOp <= 49) {
                            expr = p.make(COMPOUND_ASSIGN, prevExpr.start, {
                                end: pos,
                                operator: prevOp,
                                lhs: prevExpr,
                                rhs: expr
                            });
                        } else {
                            expr = p.make(BINARY, prevExpr.start, {
                                end: pos,
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
                        a = AssignmentExpression(p, noIn);
                        p.expect(58);
                        b = AssignmentExpression(p, noIn);
                        expr = p.make(AST_IF, expr.start, {
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
            } else expr = p.make(UNARY, expr.start, { operator: op, operand: expr });
        }
        op = 0;
    }
};

function Expression (p, noIn) {
    var list, pos = p.pos(), expr = AssignmentExpression(p, noIn);
    if (p.match(44)) {
        list = [expr];
        do list.push(AssignmentExpression(p, noIn));
        while (p.match(44));
        return p.make(EXPR_LIST, pos, { list: list });
    } else return expr;
}

function Try(p, pos) {
    var hasTry = 0;
    p.expect(123);
    var n = {
        tryBlock: p.expect(Block)
    };
    if (p.matchIdent("catch")) {
        p.expect(40);
        n.exception = p.expectIdent();
        p.expect(123);
        n.catchBlock = Block(p);
        hasTry = 1;
    } else n.catchBlock = null;
    
    if (p.matchIdent("finally")) {
        p.expect(123);
        n.finallyBlock = Block(p);
    } else if (hasTry) {
        n.finallyBlock = null;
    } else {
        p.raise("Expected catch or finally");
    }
    
    return p.make(AST_TRY, pos, n);
}

function With(p, pos) {
    p.expect(40);
    var obj = Expression(p);
    p.expect(41);
    var body = Statement(p);
    return p.make(AST_WITH, pos, {
        obj: obj,
        body: body
    });
}

function Switch(p, pos) {
    p.expect(40);
    var obj = Expression(p);
    p.expect(123);
    var cases = [], theCase = 0, newCase, s = {};
    while (!p.match(125)) {
        p.save(s);
        if (p.matchIdent("case")) {
            newCase = {
                isDefault: false,
                value: Expression(p)
            };
            p.expect(58);
        } else if (p.matchIdent("default")) {
            newCase = {
                isDefault: true
            };
            p.expect(58);
        } else if (theCase === 0) {
            p.raise("Expected case or default");
        } else {
            theCase.body.push(Statement(p));
            continue;
        }
        if (theCase) cases.push(theCase);
        theCase = newCase;
        theCase.body = [];
    }
    if (theCase) cases.push(theCase);
    return p.make(AST_SWITCH, pos, {
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
    var lexer = new Lexer(text, filename);
    var parser = new Parser(lexer);
    var body = SourceElements(parser);
    return parser.make(AST_PROGRAM, 0, { body: body });
};

