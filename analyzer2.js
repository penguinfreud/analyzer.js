var TypeToString = [""];

var addType = function (type) {
	return TypeToString.push(type) - 1;
};

var CONSTANT = addType("const"),
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
BLOCK_WITH = ++iter,
BLOCK_EXIT = ++iter,
BLOCK_ENTRY = ++iter;

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
	
	dominator: null,
	postDominator: null,
	isLoopHead: 0,
	isLoopCondition: 0,
	
	__init__: function (type) {
		this.id = 0;
		this.type = type || BLOCK_NORMAL;
		this.attr = null;
		this.scope = scope;
		this.nodes = [];
		this.pred = [];
		this.succ = [];
		this.open = 1;
		
		this.dominator = null;
		this.postDominator = null;
		this.isLoopHead = 0;
		this.isLoopCondition = 0;
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
	
	node: function (type, value, operands) {
		if (this.open) {
			var node = new Node();
			node.type = type;
			node.value = value;
			node.block = this;
			node.operands = operands;
			this.nodes.push(node);
			return node;
		}
	},
	
	last: function () {
		return this.nodes[this.nodes.length - 1];
	},
	
	toString: function () {
		return "block(" + this.id + ")";
	},
	
	print: function () {
		return "block(" + this.id + ")\n\t" +
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
		this.entry = new BasicBlock(BLOCK_ENTRY);
		this.exit = new BasicBlock(BLOCK_EXIT);
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

var Func = extend(FuncBase, {
	__init__: function () {
		if (scope && scope.funcs) {
			scope.funcs.push(this);
		}
		__super__(FuncBase, this);
	}
});

var Program = extend(FuncBase, {
	database: null,
	
	__init__: function () {
		__super__(FuncBase, this);
		program = this;
		this.database = [];
		Predicate.onDbChange();
	}
});

var program;

var CFG = (function () {
	var block, stack, unresolved, blockType;
	
	var blockCount = 0;
	
	var count = function (block) {
		var pending = [block], visited = [];
		while (pending.length > 0) {
			block = pending.pop();
			if (visited.indexOf(block) === -1) {
				visited.push(block);
				blockCount++;
				push.apply(pending, block.succ);
			}
		}
	};
	
	var num = function (block, visited) {
		if (visited.indexOf(block) === -1) {
			visited.push(block);
			var succ = block.succ, i, l = succ.length;
			if (l > 0) {
				for (i = 0; i<l; i++) {
					num(succ[i], visited);
				}
			}
			block.id = blockCount--;
			scope.blockMap[block.id] = block;
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
	
	var assign = function (lhs, rhs) {
		var v = scope.resolveRef(lhs.name),
		node = block.node(ASSIGN, v || lhs.name, [rhs]);
		if (!v) unresolved.push(node);
		return node;
	};
	
	var walk = function(ast) {
		var t = ast.type, i,
		savedStack, savedUnresolved, savedBlockType,
		list, succ, old, body, catchBlock, finallyBlock,
		cond, sequent, alternate, condBlock,
		iterator, init, obj,
		target, label, v, ref, func, res, type,
		lhs, rhs, prop, decl, op, a, b;
		if (t === AST_PROGRAM || t === AST_FUNC) {
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
			blockCount = 0;
			count(func.entry);
			num(func.entry, []);
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
			block.node(BRANCH, null, [cond]);
			old = block;
			block = block.newBlock(blockType);
			sequent = check(block) && walk(ast.sequent);
			if (t === CONDITION) {
				v = scope.localVar();
				block.node(ASSIGN, v, [sequent]);
			}
			block.connect(succ);
			if (ast.alternate) {
				block = old.newBlock(blockType);
				alternate = check(block) && walk(ast.alternate);
				if (t === CONDITION) {
					block.node(ASSIGN, v, [alternate]);
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
			condBlock = block = block.jumpNewBlock(blockType);
			block.isLoopHead = 1;
			pushStack(ast, succ, condBlock);
			cond = walk(ast.cond);
			block.isLoopCondition = 1;
			block.node(BRANCH, null, [cond]);
			body = block.newBlock();
			block.connect(succ);
			block = body;
			check(body) && walk(ast.body);
			if (t === AST_FOR_LOOP && block.open) {
				walk(ast.update);
			}
			block.jump(condBlock);
			stack.pop();
			check(succ);
			block = succ;
		} else if (t === AST_DO_WHILE) {
			succ = new BasicBlock(blockType);
			condBlock = new BasicBlock(blockType);
			pushStack(ast, succ, condBlock);
			body = block = block.jumpNewBlock();
			block.isLoopHead = 1;
			check(body) && walk(ast.body);
			block.jump(condBlock);
			block = condBlock;
			if (check(condBlock)) {
				cond = walk(ast.cond);
				block.isLoopCondition = 1;
				block.node(BRANCH, null, [cond]);
				block.connect(body);
				block.connect(succ);
			}
			stack.pop();
			block = succ;
			check(succ);
		} else if (t === AST_FOR_IN) {
			iterator = ast.iterator;
			if (iterator.type === AST_VAR_DECL) {
				v = scope.localVar();
				v.name = iterator.name;
				if (iterator.init) {
					init = walk(iterator.init);
					block.node(ASSIGN, v, [init]);
				}
				iterator = {
					type: REFERENCE,
					name: iterator.name
				};
			}
			if (block.open) {
				obj = walk(ast.obj);
				cond = block.jumpNewBlock(blockType);
				cond.isLoopHead = cond.isLoopCondition = 1;
				succ = new BasicBlock();
				cond.node(FOR_IN_BRANCH, null, [obj]);
				pushStack(ast, succ, cond);
				body = cond.newBlock(blockType);
				if (check(body)) {
					walk({ type: ASSIGN, lhs: iterator, rhs: { type: FOR_IN_INIT, obj: obj } });
					walk(ast.body);
				}
				block.jump(cond);
				cond.connect(succ);
				check(succ);
				block = succ;
			}
			stack.pop();
		} else if (t === FOR_IN_INIT) {
			return block.node(FOR_IN_INIT, null, [ast.obj]);
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
		} else if (t === RETURN || t === THROW) {
			obj = walk(ast.value);
			block.node(t, null, [obj]);
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
			return block.node(NEW, null, res);
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
			return block.node(CALL, null, res);
		} else if (t === MEMBER) {
			obj = walk(ast.obj);
			prop = walk(ast.prop);
			return block.node(MEMBER, null, [obj, prop]);
		} else if (t === UNARY) {
			obj = walk(ast.operand);
			return block.node(UNARY, ast.operator, [obj]);
		} else if (t === BINARY) {
			op = ast.operator;
			if (op === 36 || op === 37) {
				v = scope.localVar();
				cond = walk(ast.first);
				block.node(ASSIGN, v, [cond]);
				if (op === 37) {
					cond = block.node(UNARY, 14, [obj]);
				}
				block.node(BRANCH, null, [cond]);
				old = block;
				sequent = block = block.newBlock(blockType);
				alternate = walk(ast.second);
				block.node(ASSIGN, v, [alternate]);
				succ = block = sequent.newBlock(blockType);
				old.connect(succ);
				return succ.node(REFERENCE, v);
			} else {
				a = walk(ast.first);
				b = walk(ast.second);
				return block.node(BINARY, op, [a, b]);
			}
		} else if (t === ASSIGN) {
			type = ast.lhs.type;
			if (type === REFERENCE) {
				return assign(ast.lhs, walk(ast.rhs));
			} else if (type === MEMBER) {
				obj = walk(ast.lhs.obj);
				prop = walk(ast.lhs.prop);
				rhs = walk(ast.rhs)
				return block.node(MEMBER_ASSIGN, null, [obj, prop, rhs]);
			} else {
				raise("Invalid LHS");
			}
		} else if (t === COMPOUND_ASSIGN) {
			lhs = ast.lhs;
			op = assignOperatorTable[ast.operator];
			if (lhs.type === REFERENCE) {
				rhs = walk(ast.rhs);
				rhs = block.node(BINARY, op, [walk(lhs), rhs]);
				return assign(lhs, rhs);
			} else if (lhs.type === MEMBER) {
				obj = walk(lhs.obj);
				prop = walk(lhs.prop);
				lhs = block.node(MEMBER, null, [obj, prop]);
				rhs = walk(ast.rhs);
				rhs = block.node(BINARY, op, [lhs, rhs]);
				block.node(MEMBER_ASSIGN, null, [obj, prop, rhs]);
				return rhs;
			} else {
				raise("Invalid LHS");
			}
		} else if (t === EXPR_LIST) {
			list = ast.list;
			for (i = 0; i<list.length; i++) {
				a = walk(list[i]);
			}
			return a;
		} else if (t === DEBUGGER) {
			block.node(DEBUGGER, null);
		} else if (t === ARRAY_LITERAL) {
			list = ast.value;
			res = [];
			for (i = 0; i<list.length; i++) {
				res.push(walk(list[i]));
			}
			return block.node(ARRAY_LITERAL, null, res);
		} else if (t === OBJECT_LITERAL) {
			list = ast.props;
			res = [];
			for (i = 0; i<list.legnth; i++) {
				prop = list[i];
				if (prop.value) {
					a = walk(prop.value);
					res.push(block.node(PROPERTY, prop.key, [a]));
				} else if (prop.get) {
					a = walk(prop.get);
					res.push(block.node(GETTER, prop.key, [a]));
				} else if (prop.set) {
					a = walk(prop.set);
					res.push(block.node(SETTER, prop.key, [a]));
				}
			}
			return block.node(OBJECT_LITERAL, null, res);
		} else if (t === AST_EMPTY) {
		} else if (t === AST_VAR_DECL_LIST) {
			list = ast.decls;
			for (i = 0; i<list.length; i++) {
				decl = list[i];
				v = scope.localVar();
				v.name = decl.name;
				if (decl.init) {
					a = walk(decl.init);
					block.node(ASSIGN, v, [a]);
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

var _commonDom = function (a, b, stack, reverse) {
	var chain = [];
	do {
		chain.push(a);
		a = getDominator(a, stack, reverse);
	} while (a);
	
	while (b && chain.indexOf(b) === -1) {
		b = getDominator(b, stack, reverse);
	}
	return b;
};

var getDominator = function (block, stack, reverse) {
	var preds, i, l, t = null, s;
	t = reverse? block.postDominator: block.dominator;
	if (t) return t;
	preds = reverse? block.succ: block.pred;
	l = preds.length;
	if (!reverse && block.isLoopHead) {
		t = preds[0];
	} else if (reverse && stack.indexOf(block) >= 0) {
		return preds[1];
	} else if (l > 0) {
		s = 0;
		if (reverse && l > 1 && block.isLoopCondition) s = 1, stack.push(block);
		t = preds[0];
		for (i = 1; i<l; i++) t = _commonDom(t, preds[i], stack, reverse);
		if (s) stack.pop();
	}
	if (reverse) block.postDominator = t;
	else block.dominator = t;
	return t;
};

var computeDominators = function (func) {
	var list = func.blockMap, i, l = list.length, block;
	for (i = 1; i<l; i++) {
		block = list[i];
		block && getDominator(block, [], 0);
	}
};

var computePostDominators = function (func) {
	var list = func.blockMap, i = list.length, block;
	while (--i) {
		block = list[i];
		block && getDominator(block, [], 1);
	}
};

var Dom = function (a, b) {
    while (b) {
        if (a === b) return 1;
        b = b.dominator;
    }
    return 0;
};

var Pdom = function (a, b) {
    while (b) {
        if (a === b) return 1;
        b = b.postDominator;
    }
    return 0;
};

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

function HashArray() {
	var h = 0, i;
	for (i = 0; i < arguments.length; i++) {
		h += arguments[i];
		h += (h << 10);
		h ^= (h >> 6);
	}
	h += (h << 3);
	h ^= (h >> 11);
	h += (h << 15);
	return h;
}

var Var = extend(Object, {
	id: 0,
	isVar: 1,
	
	__init__: function () {
		this.id = ++Var.idCounter;
	}
});

Var.idCounter = 0;

var _ = new Var();

var PredicateBase = extend(Object, {
	has: _void,
	query: _void,
	queryAll: _void
});

var _ctor = function () {};

var copy = function (o) {
	_ctor.prototype = o;
	return new _ctor;
};

function MatchVar(x, val, s, binding, newBinding) {
	var id, v, id2, v2;
	if (val.isVar) {
		if (v = binding[id = val.id]) return x === v;
		newBinding[id] = x;
		return 1;
	}
	return 0;
}

function Match(a1, a2, b, nb) {
	var i, b1, b2, l = a1.length;
	for (i = 0; i<l; i++) {
		b1 = a1[i];
		b2 = a2[i];
		if (b1 === _ || b2 === _ || b1 === b2) continue;
		if (!MatchVar(b1, b2, 0, b, nb)) return 0;
	}
	return 1;
}

function _Match(a1, a2) {
	var i;
	for (i = 0; i<a1.length; i++)
		if (a1[i] !== a2[i]) return 0;
	return 1;
}

function Unwrap(x, b) {
	if (x.isVar) {
		var v = b[x.id];
		if (v && v.isVar) return Unwrap(v, b);
		else if (v !== undefined) return v;
	}
	return x;
}

function Subst(args, b) {
	var i, res = [], v, w, map = {};
	for (i = 0; i<args.length; i++) {
		v = res[i] = Unwrap(args[i], b);
		if (v.isVar) {
			w = map[v.id];
			if (!w) w = map[v.id] = new Var();
			res[i] = w;
		}
	}
	return res;
}

var _1 = 0;
var Predicate = extend(PredicateBase, {
	id: 0,
	rules: null,
	dependedBy: null,
	newRows: null,
	table: null,
	keys: null,
	hash: _void,
	generation: 0,
	
	__init__: function (keys, noDup) {
		this.id = ++Predicate.idCounter;
		Predicate.predicates.push(this);
		this.rules = [];
		this.dependedBy = [];
		this.newRows = [];
		this.table = null;
		if (!keys) keys = [];
		this.keys = keys;
		this.hash = $HashFunc(keys);
		this._hash = _$HashFunc(keys);
		this.generation = 0;
	},
	
	createTable: function () {
		return {
			data: [],
			hash: []
		};
	},
	
	getTable: function () {
		if (program) {
			var tbl;
			if (!(tbl = program.database[this.id])) {
				tbl = program.database[this.id] = this.createTable();
			}
			return tbl;
		} else {
			raise("No program");
		}
	},
	
	lower: function (h) {
		if (h === 0) return 0;
		var a = this.table.hash, l = 0, u = a.length, i, v;
		while (l < u) {
			if (a[i = (l + u) >> 1] < h) l = i + 1;
			else u = i;
		}
		return l;
	},
	
	upper: function (h, l) {
		var a = this.table.hash, u = a.length, i, v;
		if (h === 0) return u;
		if (a[l + 3] > h) u = l + 3;
		while (l < u) {
			if (a[i = (l + u) >> 1] <= h) l = i + 1;
			else u = i;
		}
		return l;
	},
	
	assert: function (args) {
		var t = this.table, d = t.data, h = this._hash(args),
		l = this.lower(h), u = this.upper(h, l);
		for (; l<u; l++) if (_Match(d[l], args)) return;
		d.splice(u, 0, args);
		t.hash.splice(u, 0, h);
		this.newRows.push(args);
	},
	
	has: function (args, binding) {
		var table = this.table.data, h = this.hash(args, binding),
		l = this.lower(h), u = this.upper(h, l),
		newBinding = {}, i;
		for (i = l; i<u; i++) {
			if (Match(table[i], args, binding, newBinding)) return 1;
		}
		return 0;
	},
	
	query: function (args, binding, cb) {
		var table = this.table.data, h = this.hash(args, binding),
		l = this.lower(h), u = this.upper(h, l),
		i, b = Object.create(binding);
		for (i = l; i<u; i++) {
			if (Matcher(table[i], args, binding, b)) cb(b);
		}
	},
	
	_query: function (b, r, j, i) {
var t=this.table.data,
h=r.hashFuncs[j][i](0,b),
l=this.lower(h),u=this.upper(h,l),
m=r.matchers[j][i];
for(;l<u;l++)
if(m(t[l],b))r.cb(b,j,i+1);
},
	
	queryAll: function (args, binding) {
		var table = this.table.data, h = this.hash(args, binding),
		l = this.lower(h), u = this.upper(h, l),
		i, row, b = Object.create(binding), result = [];
		for (i = l; i<u; i++) {
			row = table[i];
			if (Match(row, args, binding, b)) {
				result.push([row, b]);
				b = Object.create(binding);
			}
		}
		return result;
	},
	
	rule: function (head) {
		this.rules.push(new Rule(this, head, slice.call(arguments, 1)));
	},
	
	refresh: function (rows) {
		var dep = this.dependedBy, i;
		for (i = 0; i<dep.length; i++)
			dep[i].refresh(this, rows);
	},
	
	beginUpdate: function () {
		this.newRows.length = 0;
	},
	
	_shouldUpdate: 0,
	endUpdate: function () {
		var rows = this.newRows;
		if (rows.length > 0) {
			this.generation++;
			this.newRows = [];
			this.refresh(rows);
		}
	}
});

Predicate.idCounter = 0;
Predicate.predicates = [];

Predicate.onDbChange = function () {
	var list = this.predicates, i;
	for (i = 0; i<list.length; i++) {
		list[i].table = program && list[i].getTable();
		list[i].newRows = [];
	}
};

var _HashFuncMap = {};

_HashFuncMap[""] = function () {
	return 0;
};

var $HashFunc = function (keys) {
	var h = keys.join(",");
	if (hasOwnProperty.call(_HashFuncMap, h))
		return _HashFuncMap[h];
	var code = ["var "], i, k;
	for (i = 0; i<keys.length; i++) {
		k = keys[i];
		if (i) code.push(",");
		code.push("c", k, "=Unwrap(a[", k, "],b)");
	}
	code.push(";if(c", keys.join(".isVar||c"), ".isVar)return 0;",
		"return HashArray(c", keys.join(".id, c"), ".id);");
	return new Function("a,b", code.join(""));
};

var _$HashFunc = function (keys) {
	var h = "_" + keys.join(",");
	if (hasOwnProperty.call(_HashFuncMap, h))
		return _HashFuncMap[h];
	return new Function("a", "return HashArray(a[" + keys.join("].id, a[") + "].id);");
};

var Rule = extend(Object, {
	predicate: null,
	head: null,
	body: null,
	hashFuncs: null,
	matchers: null,
	dep: null,
	depGen: 0,
	varMap: null,
	_cb: null,
	
	__init__: function (predicate, head, body) {
		this.predicate = predicate;
		this.dep = [];
		this.depGen = [];
		this.varMap = {};
		this._cb = [];
		
		this.head = this.parse(head);
		this.body = [];
		this.hashFuncs = [];
		this.matchers = [];
		
		var i, atom, pred, l = body.length;
		for (i = 0; i<l; i++) {
			pred = body[i][0];
			this.body[i] = this.parse(body[i][1]);
			pred.dependedBy.push(this);
			this.dep.push(pred);
			this.depGen.push(0);
		}
		
		this.compileMatchers();
	},
	
	parse: function (str) {
		var parts = str.split(/\s*,\s*/g),
		args = [], i, name, map = this.varMap;
		for (i = 0; i<parts.length; i++) {
			name = parts[i];
			if (hasOwnProperty.call(map, name)) {
				args[i] = map[name];
			} else {
				args[i] = map[name] = new Var();
			}
		}
		return args;
	},
	
	refresh: function (p, r) {
		var i, j = this.dep.indexOf(p),
		b = {}, m = this.matchers[j][j];
		for (i = 0; i<r.length; i++) {
			m(r[i], b);
			this.cb(b, j, 0);
		}
		this.predicate.endUpdate();
	},
	
	cb: function (b, j, i) {
		var dep = this.dep, l = dep.length;
		if (i === j) i++;
		if (i >= l) this.predicate.assert(Subst(this.head,b));
		else dep[i]._query(b, this, j, i);
	},
	
	compileMatcher: function (binding, j, i) {
		var m, id, code, k;
		body = this.body[i],
		bound = [],
		cond = [],
		bind = [],
		dup = {},
		keys = this.dep[i].keys,
		noHash = 0;
		for (k = 0; k<body.length; k++) {
			id = body[k].id;
			m = keys.indexOf(k);
			if (binding[id] === 1) {
				if (m >= 0) bound[m] = id;
				cond.push("a[" + k + "]===b[" + id + "]");
				continue;
			}
			if (m >= 0) noHash = 1;
			if (typeof dup[id] === "number") {
				cond.push("a[" + k + "]===a[" + dup[id] + "]");
			} else {
				dup[id] = k;
				bind.push("b[" + id + "]=a[" + k + "];");
			}
		}
		for (k = 0; k<body.length; k++) {
			binding[body[k].id] = 1;
		}
		if (cond.length > 0) {
			code = "if(" + cond.join("&&") + "){";
		} else {
			code = "";
		}
		code += bind.join("") + "return 1;";
		if (cond.length > 0) {
			code += "}return 0;";
		}
		this.matchers[j][i] = new Function("a,b", code);
		code = noHash?
			"return 0;":
			"return HashArray(b[" + bound.join("].id,b[") + "].id);";
		this.hashFuncs[j][i] = new Function("a,b", code);
	},
	
	compileMatchers: function () {
		var i, j, l = this.body.length, binding;
		for (j = 0; j<l; j++) {
			if (this.dep[j].isFunctor) continue;
			binding = {};
			this.matchers[j] = [];
			this.hashFuncs[j] = [];
			this.compileMatcher(binding, j, j);
			for (i = 0; i<l; i++) {
				if (i === j) continue;
				if (!this.dep[i].isFunctor) {
					this.compileMatcher(binding, j, i);
				}
			}
		}
	}
});

var Functor = extend(Predicate, {
	isFunctor: 1,
	
	__init__: function (query) {
		this.id = ++Predicate.idCounter;
		this._query = query;
		Predicate.predicates.push(this);
		this.dependedBy = [];
		this.table = null;
	},
	
	createTable: function () {
		return {
			cache: {},
			confirm: {}
		};
	}
});

var $Assignment = new Predicate([1]);

var $Edge = new Functor(function (binding, rule, _j, _i) {
	var args = rule.body[_i],
	block = Unwrap(args[0], binding),
	succ, i;
	if (block) {
		succ = block.succ;
		for (i = 0; i<succ.length; i++) {
			binding[args[1].id] = succ[i];
			rule.cb(binding, _j, _i + 1);
		}
	}
});

var $NoKill = new Functor(function (binding, rule, _j, _i) {
	var args = rule.body[_i],
	block = Unwrap(args[0], binding),
	v = Unwrap(args[1], binding),
	h, cache, nodes, i, node, t, value;
	if (block && v) {
		h = HashArray(block.id, v.id);
		cache = this.table;
		if (cache.confirm[h] === block.id) {
			if (cache.cache[h]) rule.cb(binding, _j, _i + 1);
			return;
		}
		nodes = block.nodes;
		for (i = 0; i<nodes.length; i++) {
			node = nodes[i];
			t = node.type;
			value = node.value;
			if (t === ASSIGN && value === v ||
				(t === UNARY &&
					value >= 4 && value <= 10 && value !== 7 && value !== 8 &&
					node.operands[0].type === REFERENCE &&
					node.operands[0].value === v) ||
				t === NEW || t === CALL) {
				cache.confirm[h] = block.id;
				return;
			}
		}
		cache.confirm[h] = block.id;
		cache.cache[h] = 1;
		rule.cb(binding, _j, _i + 1);
	}
});

var $Kill = new Predicate([0]);

var $ReachDef = new Predicate([0, 1]);

$ReachDef.rule("D, B1, V",
	[$Assignment, "D, B2, V"],
	[$Edge, "B2, B1"]);
$ReachDef.rule("D, B1, V",
	[$ReachDef, "D, B2, V"],
	[$NoKill, "B2, V"],
	[$Edge, "B2, B1"]);

var Path = function (X, Y, visited) {
	while (X.succ.length === 1)
		X = X.succ[0];
	while (Y.pred.length === 1)
		Y = Y.pred[0];
	var succ = X.succ, i, b;
	if (succ.indexOf(Y) >= 0) return 1;
	if (!visited) visited = {};
	for (i = 0; i<succ.length; i++) {
		b = succ[i];
		if (visited[b.id]) continue;
		visited[b.id] = 1;
		if (Path(succ[i], Y, visited)) return 1;
	}
	return 0;
};

var Purge = function (func) {
	var i, map = func.blockMap, block, b2, type, succ, pred, j, k, node, l;
	for (i = 1; i<map.length; i++) {
		if (block = map[i]) {
			if (block.succ.length === 1) {
				b2 = block.succ[0];
				type = block.type;
				if (block.nodes.length === 0 &&
					type !== BLOCK_ENTRY &&
					type !== BLOCK_EXIT) {
					pred = block.pred;
					k = b2.pred.indexOf(block);
					Array.prototype.splice.apply(b2.pred, [k, 1].concat(pred));
					for (j = 0; j<pred.length; j++) {
						succ = pred[j].succ;
						k = succ.indexOf(block);
						succ[k] = b2;
					}
					map[i] = null;
					console.log("empty", i);
				} else if (b2.pred.length === 1 && type === b2.type) {
					push.apply(block.nodes, b2.nodes);
					block.succ = b2.succ;
					map[b2.id] = null;
					console.log("connect", b2.id);
				}
			}
		}
	}
};

var Analyze = function (func) {
	var map, i, block, j, nodes, node;
	Purge(func);
	map = func.blockMap;
	for (i = 1; i<map.length; i++) {
		if (block = map[i]) {
			nodes = block.nodes;
			j = nodes.length;
			while (j--) {
				node = nodes[j];
				if (node.type === ASSIGN) {
					if (!$Assignment.has([_, block, node.value])) {
						$Assignment.assert([node, block, node.value]);
					}
				}
			}
		}
	}
	$Assignment.endUpdate();
};
