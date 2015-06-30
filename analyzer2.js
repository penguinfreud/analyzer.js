var TypeToString = [""];

var addType = function (type) {
    return TypeToString.push(type) - 1;
};

var IDENTITY = addType("identity"),
CONSTANT = addType("const"),
REFERENCE = addType("ref"),
FUNC_REF = addType("func_ref"),
NEW = addType("new"),
CALL = addType("call"),
MEMBER = addType("member"),
UNARY = addType("unary"),
BINARY = addType("binary"),
ASSIGN = addType("assign"),
MEMBER_ASSIGN = addType("member_assign"),
COMPOUND_ASSIGN = addType("compound_assign"),
CONDITION = addType("condition"),
EXPR_LIST = addType("expr_list"),
BRANCH = addType("branch"),
FOR_IN_BRANCH = addType("for_in_brach"),
FOR_IN_INIT = addType("for_in_init"),
BREAK = addType("break"),
CONTINUE = addType("continue"),
RETURN = addType("return"),
THROW = addType("throw"),
DEBUGGER = addType("debugger"),
ARRAY_LITERAL = addType("array"),
OBJECT_LITERAL = addType("object"),
PROPERTY = addType("property"),
GETTER = addType("getter"),
SETTER = addType("setter");

var AST_EMPTY = addType("empty"),
AST_IF = addType("if"),
AST_BLOCK = addType("block"),
AST_WHILE = addType("while"),
AST_DO_WHILE = addType("do_while"),
AST_FOR_IN = addType("for_in"),
AST_FOR_LOOP = addType("fo_loop"),
AST_VAR_DECL_LIST = addType("var_decl_list"),
AST_VAR_DECL = addType("var_decl"),
AST_FUNC = addType("func"),
AST_PROGRAM = addType("program"),
AST_TRY = addType("try"),
AST_WITH = addType("with"),
AST_SWITCH = addType("switch");

iter = 0;
var BLOCK_NORMAL = ++iter,
BLOCK_TRY = ++iter,
BLOCK_FINALLY = ++iter,
BLOCK_WITH = ++iter;

var raise = function (msg) {
    throw new Error(msg);
};

var BasicBlock = extend(Object, {
    id: 0,
    scope: null,
    type: 0,
    attr: null,
    nodes: null,
    pred: null,
    succ: null,
    open: 1,
    
    __init__: function (type) {
        this.id = 0;
        this.type = type || BLOCK_NORMAL;
        this.attr = null;
        this.scope = scope;
        this.nodes = [];
        this.pred = [];
        this.succ = [];
        this.open = 1;
    },
    
    add: function (node) {
        if (this.open) {
            node.block = this;
            this.nodes.push(node);
            return node;
        }
    },
    
    connect: function (block) {
        if (this.open) {
            this.succ.push(block);
            block.pred.push(this);
            return block;
        }
    },
    
    jump: function (block) {
        this.connect(block);
        this.open = 0;
    },
    
    newBlock: function (type) {
        var b = new BasicBlock(type);
        this.connect(b);
        return b;
    },
    
    jumpNewBlock: function (type) {
        var b = new BasicBlock(type);
        this.jump(b);
        return b;
    },
    
    node: function (type, value) {
        if (this.open) {
            var node = new Node();
            node.type = type;
            node.value = value;
            node.block = this;
            node.operands = slice.call(arguments, 2);
            this.nodes.push(node);
            return node;
        }
    },
    
    last: function () {
        return this.nodes[this.nodes.length - 1];
    },
    
    toString: function () {
        return "BasicBlock(" + this.id + ")\n\t" +
            this.nodes.join("\n\t");
    }
});

var slice = Array.prototype.slice;

var Node = extend(Object, {
    id: 0,
    type: 0,
    value: null,
    operands: null,
    block: null,
    
    __init__: function () {
        this.id = ++scope.nodeCounter;
        scope.nodeMap[this.id] = this;
    },
    
    toString: function () {
        var s = TypeToString[this.type] + "(" + this.id,
        t = this.type;
        if (t === CONSTANT || t === PROPERTY || t === GETTER || t === SETTER) {
            s += ", " + JSON.stringify(this.value);
        } else if (t === REFERENCE || t === ASSIGN) {
            s += ", " + this.value.id;
        } else if (t === UNARY || t === BINARY) {
            s += ", " + opReverseTable[this.value];
        }
        return s + ")";
    }
});

var Variable = extend(Object, {
    id: 0,
    name: "",
    value: null,
    scope: null,
    isBuiltin: 0,
    
    __init__: function () {
        this.id = ++Variable.idCounter;
        Variable.varMap[this.id] = this;
        this.scope = scope;
    },
    
    toString: function () {
        return "var(" + this.id + (this.name? ", " + this.name: "") + ")";
    }
});

Variable.varMap = {};
Variable.idCounter = 0;

var Scope = extend(Object, {
    parentScope: null,
    
    vThis: null,
    vReturn: null,
    vError: null,
    
    locals: null,
    funcs: null,
    
    __init__: function () {
        this.parentScope = scope;
        scope = this;
        this.locals = [];
        this.funcs = [];
        this.vThis = new Variable();
        this.vReturn = this.localVar();
        this.vError = this.localVar();
    },
    
    close: function () {
        scope = this.parentScope;
    },
    
    localVar: function () {
        var v = new Variable();
        this.locals.push(v);
        return v;
    },
    
    builtin: function (name, value) {
        var v = this.localVar();
        v.name = name;
        v.value = value;
        v.builtin = 1;
    },
    
    resolveRef: function (name) {
        var list, v, i, ret;
        
        list = this.locals;
        for (i = 0; i<list.length; i++) {
            v = list[i];
            if (v.name === name) {
                return v;
            }
        }
        
        list = this.funcs;
        for (i = 0; i<list.length; i++) {
            v = list[i];
            if (v.decl && v.name === name) {
                return v;
            }
        }
        
        ret = this._resolveRef();
        if (ret) {
            return ret;
        }
        if (this.parentScope) {
            return this.parentScope.resolveRef(name);
        }
    },
    
    _resolveRef: _void
});

var scope = null;
new Scope();

var AbstractScope = extend(Scope, {
    varMap: null,
    
    __init__: function () {
        __super__(Scope, this);
        this.varMap = {};
    },
    
    resolveRef: function (name) {
        var ret, v;
        if (this.parentScope) {
            ret = this.parentScope.resolveRef(name);
            if (ret) {
                return ret;
            }
        }
        if (hasOwnProperty.call(this.varMap, name)) {
            return this.varMap[name];
        }
        v = this.varMap[name] = this.localVar();
        v.name = name;
        return v;
    }
});

var FuncBase = extend(Scope, {
    id: 0,
    
    ast: null,
    
    entry: null,
    exit: null,
    blockCounter: 0,
    nodeCounter: 0,
    blockMap: null,
    nodeMap: null,
    
    funcs: null,
    params: null,
    
    __init__: function () {
        if (scope && scope.funcs) {
            scope.funcs.push(this);
        }
        new AbstractScope();
        __super__(Scope, this);
        this.id = ++FuncBase.idCounter;
        FuncBase.funcMap[this.id] = this;
        this.blockCounter = 0;
        this.nodeCounter = 0;
        this.blockMap = [];
        this.nodeMap = [];
        this.funcs = [];
        this.params = [];
        this.entry = new BasicBlock();
        this.exit = new BasicBlock();
    },
    
    close: function () {
        scope = this.parentScope.parentScope;
    },
    
    _resolveRef: function (name) {
        var list = this.params, i, v;
        for (i = 0; i<list.length; i++) {
            v = list[i];
            if (v.name === name) {
                return v;
            }
        }
    }
});

FuncBase.idCounter = 0;
FuncBase.funcMap = {};

var Func = extend(FuncBase);
var Program = extend(FuncBase);

var CFG = (function () {
    var block, stack, unresolved, blockType;
    
    var num = function (block) {
        var pending = [block];
        while (pending.length > 0) {
            block = pending.shift();
            if (block.id === 0) {
                block.id = ++scope.blockCounter;
                scope.blockMap[block.id] = block;
                push.apply(pending, block.succ);
            }
        }
    };
    
    var check = function (b) {
        return b.open = b.pred.length;
    };
    
    var isLoop = listToTable([AST_FOR_IN, AST_FOR_LOOP, AST_WHILE, AST_DO_WHILE]);
    var anonBreak = Object.create(isLoop);
    anonBreak[AST_SWITCH] = 1;
    var breakable = Object.create(anonBreak);
    breakable[AST_IF] = 1;
    breakable[AST_BLOCK] = 1;
    
    var pushStack = function (ast, breakTarget, continueTarget) {
        var t = ast.type;
        stack.push({
            labels: ast.labels,
            type: ast.type,
            breakTarget: breakTarget,
            continueTarget: continueTarget
        });
    };
    
    var _body = function (a, ast) {
        var b = block = a.newBlock(blockType);
        check(b);
        walk(ast.body);
        return b;
    };
    
    var assignOperatorTable = {
        39: 15,
        40: 16,
        41: 17,
        42: 18,
        43: 19,
        44: 20,
        45: 21,
        46: 22,
        47: 33,
        48: 34,
        49: 35
    };
    
    var walk = function(ast) {
        var t = ast.type, node, i,
        savedStack, savedUnresolved, savedBlockType,
        list, succ, old, body, catchBlock, finallyBlock,
        cond, sequent, alternate, iterator, init, obj,
        target, label, v, ref, func, node, res, type,
        lhs, rhs, prop, decl, op, a, b, c;
        if (t === IDENTITY) {
            return ast.node;
        } else if (t === AST_PROGRAM || t === AST_FUNC) {
            if (t === AST_PROGRAM) {
                func = new Program();
                blockType = BLOCK_NORMAL;
            } else {
                func = new Func();
            }
            func.ast = ast;
            block = func.entry;
            
            savedStack = stack;
            savedUnresolved = unresolved;
            stack = [];
            unresolved = [];
            walk(ast.body);
            for (i = 0; i<unresolved.length; i++) {
                unresolved[i].value = func.resolveRef(unresolved[i].value);
            }
            block.jump(func.exit);
            num(func.entry);
            func.close();
            stack = savedStack;
            unresolved = savedUnresolved;
            
            if (t === AST_FUNC) {
                return block.node(FUNC_REF, null);
            } else {
                return func;
            }
        } else if (t === AST_BLOCK) {
            list = ast.stmts;
            succ = new BasicBlock(blockType);
            pushStack(ast, succ);
            for (i = 0; i<list.length && block.open; i++) {
                walk(list[i]);
            }
            if (check(succ)) {
                block.jump(succ);
                block = succ;
            }
            stack.pop();
        } else if (t === AST_IF || t === CONDITION) {
            succ = new BasicBlock(blockType);
            pushStack(ast, succ);
            cond = walk(ast.cond);
            block.node(BRANCH, null, cond);
            old = block;
            block = block.newBlock(blockType);
            sequent = check(block) && walk(ast.sequent);
            if (t === CONDITION) {
                v = scope.localVar();
                block.node(ASSIGN, v, sequent);
            }
            block.connect(succ);
            if (ast.alternate) {
                block = old.newBlock(blockType);
                alternate = check(block) && walk(ast.alternate);
                if (t === CONDITION) {
                    block.node(ASSIGN, v, alternate);
                }
                block.connect(succ);
            } else {
                old.connect(succ);
            }
            block = succ;
            stack.pop();
            check(succ);
            if (t === CONDITION) {
                return block.node(REFERENCE, v);
            }
        } else if (t === AST_WHILE || t === AST_FOR_LOOP) {
            if (t === AST_FOR_LOOP) {
                walk(ast.init);
            }
            succ = new BasicBlock(blockType);
            cond = block = block.jumpNewBlock(blockType);
            pushStack(ast, succ, cond);
            cond.node(BRANCH, null, walk(ast.cond));
            body = block = cond.newBlock();
            check(body) && walk(ast.body);
            if (t === AST_FOR_LOOP && body.open) {
                walk(ast.update);
            }
            body.jump(cond);
            cond.connect(succ);
            stack.pop();
            check(succ);
            block = succ;
        } else if (t === AST_DO_WHILE) {
            succ = new BasicBlock(blockType);
            cond = new BasicBlock(blockType);
            pushStack(ast, succ, cond);
            body = block = block.jumpNewBlock();
            check(body) && walk(ast.body);
            block = cond;
            body.jump(cond);
            check(cond) && cond.node(BRANCH, null, walk(ast.cond));
            stack.pop();
            cond.connect(body);
            cond.connect(succ);
            block = succ;
            check(succ);
        } else if (t === AST_FOR_IN) {
            iterator = ast.iterator;
            if (iterator.type === AST_VAR_DECL) {
                v = scope.localVar();
                v.name = iterator.name;
                if (iterator.init) {
                    ref = block.node(REFERENCE, v);
                    init = walk(iterator.init);
                    block.node(ASSIGN, null, ref, init);
                }
                iterator = {
                    type: REFERENCE,
                    name: iterator.name
                };
            }
            if (block.open) {
                obj = walk(ast.obj);
                cond = block.jumpNewBlock(blockType);
                succ = new BasicBlock();
                cond.node(FOR_IN_BRANCH, null, obj);
                pushStack(ast, succ, cond);
                body = cond.newBlock(blockType);
                if (check(body)) {
                    walk({ type: ASSIGN, lhs: iterator, rhs: { type: FOR_IN_INIT, obj: obj } });
                    walk(ast.body);
                }
                body.jump(cond);
                cond.connect(succ);
                check(succ);
                block = succ;
            }
            stack.pop();
        } else if (t === FOR_IN_INIT) {
            return block.node(FOR_IN_INIT, null, ast.obj);
        } else if (t === BREAK) {
            i = stack.length;
            label = ast.label;
            while (i--) {
                target = stack[i];
                if (label?
                    breakable[target.type] && target.labels && target.labels.indexOf(label) >= 0:
                    isLoop[target.type]) {
                    block.jump(target.breakTarget);
                    break;
                }
            }
            if (i === -1)
                raise("Target not found");
        } else if (t === CONTINUE) {
            i = stack.length;
            label = ast.label;
            while (i--) {
                target = stack[i];
                if (isLoop[target.type] &&
                        (!label || target.labels && target.labels.indexOf(label) >= 0)) {
                    block.jump(target.continueTarget);
                    break;
                }
            }
            if (i === -1)
                raise("Target not found");
        } else if (t === RETURN) {
            block.node(RETURN, null, walk(ast.value));
            block.jump(scope.exit);
        } else if (t === THROW) {
            block.node(THROW, null, walk(ast.value));
            block.jump(scope.exit);
        } else if (t === REFERENCE) {
            if (ast.name === "this") {
                v = scope.vThis;
            } else {
                v = scope.resolveRef(ast.name);
            }
            ref = block.node(REFERENCE, v || ast.name);
            if (!v) {
                unresolved.push(ref);
            }
            return ref;
        } else if (t === CONSTANT) {
            return block.node(CONSTANT, ast.value);
        } else if (t === NEW) {
            list = ast.args;
            res = [walk(ast.func)];
            for (i = 0; i<list.length; i++) {
                res.push(walk(list[i]));
            }
            node = block.node(NEW, null);
            node.operands = res;
            return node;
        } else if (t === CALL) {
            func = walk(ast.func);
            res = [func];
            if (func.type === MEMBER) {
                res.push(func.operands[0]);
            } else {
                res.push(block.node(CONSTANT, undefined));
            }
            list = ast.args;
            for (i = 0; i<list.length; i++) {
                res.push(walk(list[i]));
            }
            node = block.node(CALL, null);
            node.operands = res;
            return node;
        } else if (t === MEMBER) {
            return block.node(MEMBER, null, walk(ast.obj), walk(ast.prop));
        } else if (t === UNARY) {
            op = ast.operator;
            if (op === 4 || op === 5 || op === 9 || op === 10) {
                lhs = ast.operand;
                a = op === 4 || op === 9? 18: 19;
                if (lhs.type === REFERENCE) {
                    obj = walk(lhs);
                    if (op <= 5) {
                        v = scope.localVar();
                        block.node(ASSIGN, v, obj);
                    }
                    rhs = block.node(BINARY, a, obj, block.node(CONSTANT, 1));
                    walk({ type: ASSIGN, lhs: lhs, rhs: { type: IDENTITY, node: rhs } });
                } else if (lhs.type === MEMBER) {
                    obj = walk(lhs.obj);
                    prop = walk(lhs.prop);
                    lhs = block.node(MEMBER, null, obj, prop);
                    if (op <= 5) {
                        v = scope.localVar();
                        block.node(ASSIGN, v, lhs);
                    }
                    rhs = block.node(BINARY, op, lhs, walk(ast.rhs));
                    block.node(MEMBER_ASSIGN, null, obj, prop, rhs);
                } else {
                    raise("Invalid LHS");
                }
                return op <= 5? block.node(REFERENCE, v): rhs;
            }
            return block.node(UNARY, ast.operator, walk(ast.operand));
        } else if (t === BINARY) {
            op = ast.operator;
            if (op === 36 || op === 37) {
                v = scope.localVar();
                cond = walk(ast.first);
                block.node(ASSIGN, v, cond);
                if (op === 37) {
                    cond = block.node(UNARY, 14, obj);
                }
                block.node(BRANCH, null, cond);
                old = block;
                sequent = block = block.newBlock(blockType);
                sequent.node(ASSIGN, v, walk(ast.second));
                succ = block = sequent.newBlock(blockType);
                old.connect(succ);
                return succ.node(REFERENCE, v);
            } else {
                return block.node(BINARY, op, walk(ast.first), walk(ast.second));
            }
        } else if (t === ASSIGN) {
            type = ast.lhs.type;
            if (type === REFERENCE) {
                v = scope.resolveRef(ast.lhs.name);
                node = block.node(ASSIGN, v || ast.lhs.name, walk(ast.rhs));
                if (!v) {
                    unresolved.push(node);
                }
                return node;
            } else if (type === MEMBER) {
                return block.node(MEMBER_ASSIGN, null,
                    walk(ast.lhs.obj), walk(ast.lhs.prop), walk(ast.rhs));
            } else {
                raise("Invalid LHS");
            }
        } else if (t === COMPOUND_ASSIGN) {
            lhs = ast.lhs;
            op = assignOperatorTable[ast.operator];
            if (lhs.type === REFERENCE) {
                rhs = block.node(BINARY, op, walk(lhs), walk(ast.rhs));
                walk({ type: ASSIGN, lhs: lhs, rhs: { type: IDENTITY, node: rhs } });
                return rhs;
            } else if (lhs.type === MEMBER) {
                obj = walk(lhs.obj);
                prop = walk(lhs.prop);
                rhs = block.node(MEMBER, null, obj, prop);
                rhs = block.node(BINARY, op, rhs, walk(ast.rhs));
                block.node(MEMBER_ASSIGN, null, obj, prop, rhs);
                return rhs;
            } else {
                raise("Invalid LHS");
            }
        } else if (t === EXPR_LIST) {
            list = ast.list;
            for (i = 0; i<list.length; i++) {
                node = walk(list[i]);
            }
            return node;
        } else if (t === DEBUGGER) {
            block.node(DEBUGGER, null);
        } else if (t === ARRAY_LITERAL) {
            list = ast.value;
            res = [];
            for (i = 0; i<list.length; i++) {
                res.push(walk(list[i]));
            }
            node = block.node(ARRAY_LITERAL, null);
            node.operands = res;
            return node;
        } else if (t === OBJECT_LITERAL) {
            list = ast.props;
            res = [];
            for (i = 0; i<list.legnth; i++) {
                prop = list[i];
                if (prop.value) {
                    res.push(block.node(PROPERTY, prop.key, walk(prop.value)));
                } else if (prop.get) {
                    res.push(block.node(GETTER, prop.key, walk(prop.get)));
                } else if (prop.set) {
                    res.push(block.node(SETTER, prop.key, walk(prop.set)));
                }
            }
            node = block.node(OBJECT_LITERAL, null);
            node.operands = res;
            return node;
        } else if (t === AST_EMPTY) {
        } else if (t === AST_VAR_DECL_LIST) {
            list = ast.decls;
            for (i = 0; i<list.length; i++) {
                decl = list[i];
                v = scope.localVar();
                v.name = decl.name;
                if (decl.init) {
                    block.node(ASSIGN, v, walk(decl.init));
                }
            }
        } else if (t === AST_WITH) {
            succ = new BasicBlock(blockType);
            pushStack(ast, succ);
            obj = walk(ast.obj);
            savedBlockType = blockType;
            blockType = BLOCK_WITH;
            body = block.jumpNewBlock(blockType);
            body.attr = obj;
            walk(ast.body);
            body.jump(succ);
            blockType = savedBlockType;
            stack.pop();
            block = succ;
        }
    };
    
    return walk;
})();

function HashString(str) {
    var h = 0, i;
    for (i = 0; i < str.length - 1;) {
        h += (str.charCodeAt(i++) << 16);
        h += str.charCodeAt(i++);
        h += (h << 10);
        h ^= (h >> 6);
    }
    h += (h << 3);
    h ^= (h >> 11);
    h += (h << 15);
    return h;
}

function HashArray(arr) {
    var h = 0, i;
    for (i = 0; i < arr.length - 1;) {
        h += arr[i];
        h += (h << 10);
        h ^= (h >> 6);
    }
    h += (h << 3);
    h ^= (h >> 11);
    h += (h << 15);
    return h;
}

var _ = {};

var Var = extend(Object, {
    id: 0,
    isVar: 1,
    
    __init__: function () {
        this.id = ++Var.idCounter;
    }
});

Var.idCounter = 0;

var PredicateBase = extend(Object, {
    has: _void,
    query: _void,
    queryAll: _void
});

function Match(a1, a2, binding) {
    function matchVar(x, val, s) {
        var id, v, id2, v2;
        if (x.isVar) {
            id = x.id;
            v = binding[id];
            if (v && v.isVar) {
                return matchVar(val, v, s);
            } else if (v !== undefined) {
                return matchVar(val, v, 1);
            } else if (s === 0) {
                return matchVar(val, x, 2);
            } else {
                bind(id, val);
                return 1;
            }
        } else if (s === 0) {
            return matchVar(val, x, 1);
        } else if (s === 1) {
            return x === val;
        } else {
            bind(val.id, x);
            return 1;
        }
    };
    
    function bind(id, val) {
        if (f) {
            f = 0;
            binding = Object.create(binding);
        }
        binding[id] = val;
    }
    
    var i, b1, b2, f = 1, l = a1.length;
    
    if (a2.length !== l) {
        return 0;
    }
    for (i = 0; i<l; i++) {
        b1 = a1[i];
        b2 = a2[i];
        if (b1 === _ || b2 === _ || b1 === b2) {
            continue;
        }
        if (!matchVar(b1, b2, 0)) {
            return 0;
        }
    }
    return binding;
}

function Unwrap(x, binding) {
    if (x.isVar) {
        var v = binding[x.id];
        if (v && v.isVar) {
            return Unwrap(v, binding);
        } else if (v !== undefined) {
            return v;
        } else {
            return x;
        }
    } else {
        return x;
    }
}

function Subst(args, binding) {
    var i, res = [];
    for (i = 0; i<args.length; i++) {
        res[i] = Unwrap(args[i], binding);
    }
    return res;
}

var Predicate = extend(PredicateBase, {
    db: null,
    rules: null,
    dependedBy: null,
    newRows: null,
    
    __init__: function () {
        this.db = [];
        this.rules = [];
        this.dependedBy = [];
        this.newRows = [];
    },
    
    assert: function (args) {
        if (!this.has(args, {})) {
            this.db.push(args);
            this.newRows.push(args);
        }
    },
    
    has: function (args, binding) {
        var db = this.db, i, row;
        for (i = 0; i<db.length; i++) {
            row = db[i];
            if (Match(row, args, binding)) {
                return 1;
            }
        }
        return 0;
    },
    
    query: function (args, binding, cb, x) {
        var db = this.db, i, row, b;
        for (i = 0; i<db.length; i++) {
            row = db[i];
            if (b = Match(row, args, binding)) {
                cb(b, x);
            }
        }
    },
    
    queryAll: function (args, binding) {
        var db = this.db, i, row, result = [];
        for (i = 0; i<db.length; i++) {
            row = db[i];
            if (b = Match(row, args, binding)) {
                result.push([row, b]);
            }
        }
        return result;
    },
    
    rule: function (head) {
        this.rules.push(new Rule(this, head, slice.call(arguments, 1)));
    },
    
    refresh: function (rows) {
        var dep = this.dependedBy, i;
        for (i = 0; i<dep.length; i++) {
            dep[i].refresh(this, rows);
        }
    },
    
    beginUpdate: function () {
        this.newRows.length = 0;
    },
    
    endUpdate: function () {
        rows = this.newRows;
        if (rows.length > 0) {
            this.newRows = [];
            this.refresh(rows);
        }
    }
});

var Not = extend(PredicateBase, {
    predicate: null,
    
    __init__: function (predicate) {
        this.predicate = predicate;
    },
    
    has: function (args, binding) {
        return !this.predicate.has(args, binding);
    },
    
    query: function (args, binding, cb, x) {
        if (!this.predicate.has(args, binding)) {
            cb(binding, x);
        }
    },
    
    queryAll: function () {
        raise("Impossible");
    }
});

var Rule = extend(Object, {
    predicate: null,
    head: null,
    body: null,
    dependencies: null,
    _cb: null,
    
    __init__: function (predicate, head, body) {
        this.predicate = predicate;
        this.head = head;
        this.body = body;
        this.dependencies = [];
        this._cb = [];
        
        var i, atom, pred, l = body.length;
        for (i = 0; i<l; i++) {
            atom = body[i];
            pred = atom.shift();
            pred.dependedBy.push(this);
            this.dependencies.push(pred);
        }
    },
    
    refresh: function (pred, rows) {
        var i, j, body, binding, cb;
        
        j = this.dependencies.indexOf(pred);
        body = this.body[j];
        binding = {};
        cb = 0;
        
        for (i = 0; i<rows.length; i++) {
            if (b = Match(rows[i], body, binding)) {
                if (!cb) {
                    cb = this._cb[j] || this.cb(j);
                }
                cb(b, 0);
            }
        }
        
        this.predicate.endUpdate();
    },
    
    cb: function (j) {
        var dep = this.dependencies,
        pred = this.predicate,
        head = this.head,
        body = this.body;
        
        function cb(binding, i) {
            if (i === j) {
                i++;
            }
            if (i >= dep.length) {
                pred.assert(Subst(head, binding));
            } else {
                dep[i].query(body[i], binding, cb, i + 1);
            }
        }
        
        this._cb[j] = cb;
        return cb;
    }
});

var Functor = function (fn) {
    var p = new Predicate();
    p.query = fn;
    return p;
};

var PredScope = function () {
    var map = {};
    return function (name) {
        if (hasOwnProperty.call(map, name)) {
            return map[name];
        } else {
            return map[name] = new Var();
        }
    };
};

var $;

var $Assignment = new Predicate();

var $ReachDef = new Predicate();

var $Next = Functor(function (args, binding, cb, x) {
    var node = Unwrap(args[0], binding),
    block, succ, i;
    
    if (node) {
        block = node.block;
        i = block.nodes.indexOf(node);
        if (i === block.nodes.length - 1) {
            succ = block.succ;
            binding = Object.create(binding);
            for (j = 0; j<succ.length; j++) {
                if (binding[id] = succ[j].nodes[0]) {
                    cb(binding, x);
                }
            }
        } else {
            binding[id] = block.nodes[i + 1];
            cb(binding, x);
        }
    } else {
        node = Unwrap(args[1], binding);
        if (node) {
            block = node.block;
            i = block.nodes.indexOf(node);
            if (i === 0) {
                succ = block.pred;
                binding = Object.create(binding);
                for (j = 0; j<succ.length; j++) {
                    if (binding[id] = succ[j].last()) {
                        cb(binding, x);
                    }
                }
            } else {
                binding[id] = block.nodes[i - 1];
                cb(binding, x);
            }
        }
    }
});

var $NoKill = Functor(function (args, binding, cb, x) {
    var node = Unwrap(args[0], binding),
    v = Unwrap(args[1], binding), t;
    if (node && v) {
        t = node.type;
        if ((t !== ASSIGN || node.value !== v) &&
            t !== NEW && t !== CALL) {
            cb(binding, x);
        }
    }
});

$ = PredScope();
$ReachDef.rule([$("N1"), $("N2"), $("V")],
    [$Assignment, $("N1"), $("V")],
    [$Next, $("N1"), $("N2")]);
$ReachDef.rule([$("N1"), $("N2"), $("V")],
    [$ReachDef, $("N1"), $("N3"), $("V")],
    [$NoKill, $("N3"), $("V")],
    [$Next, $("N3"), $("N2")]);

var Analyze = function (func) {
    var map = func.nodeMap, node;
    for (id in map) {
        node = map[id];
        if (node.type === ASSIGN) {
            $Assignment.assert([node, node.value]);
            $Assignment.endUpdate();
        }
    }
};
