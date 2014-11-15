var stack = [], scope;

var saveScope = function (newScope) {
	stack.push(scope);
	scope = newScope;
};

var restoreScope = function () {
	scope = stack.pop();
};

var Scope = extend(Object, {
	parentScope: null,
	
	vThis: null,
	vReturn: null,
	vError: null,
	
	varMap: null,
	locals: null,
	funcs: null,
	
	__init__: function () {
		this.parentScope = scope;
		this.locals = [];
		this.funcs = [];
		this.varMap = derive(scope? scope.varMap: {});
		
		saveScope(this);
		
		this.vThis = new Variable();
		this.vReturn = this.localVar();
		this.vError = this.localVar();
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
	
	resolveRef: function (ref) {
		var name = ref.attr,
		list, v, i, l, p;
		
		list = this.locals;
		l = list.length;
		for (i = 0; i<l; i++) {
			v = list[i];
			if (v.name === name) {
				ref.attr = v;
				return;
			}
		}
		
		list = this.funcs;
		l = list.length;
		for (i = 0; i<l; i++) {
			v = list[i];
			if (v.decl && v.name === name) {
				ref.attr = v;
				ref.flags |= isFuncRef;
				return;
			}
		}
		
		this._resolveRef();
		
		if (this.parentScope) {
			this.parentScope.resolveRef(ref);
		}
	},
	
	_resolveRef: _void
});

var FuncBase = extend(Scope, {
	id: 0,
	nodeIdCounter: 0,
	cfgIdCounter: 0,
	nodeIdMap: null,
	nodeList: null,
	initValues: null,
	head: null,
	body: null,
	params: null,
	
	name: "",
	inferredName: "",
	
	unresolvedReferences: null,
	
	__init__: function () {
		if (scope) {
			scope.funcs.push(this);
		}
		__super__(Scope, this);
		this.id = ++varIdCounter;
		this.params = [];
		this.nodeIdCounter = 0;
		this.cfgIdCounter = 0;
		this.nodeIdMap = [];
		this.nodeList = [];
		this.initValues = [];
		this.unresolvedReferences = [];
	},
	
	setBody: function (body) {
		var wrapper = this.body = new Node(FUNC);
		wrapper.attr = this;
		addChild(wrapper, body);
		restoreScope();
	},
	
	cfg: function () {
		this.head = new Node(FUNC_HEAD);
		this.head.attr = this;
		this.nodeList.push(this.head);
		CFG(this.head, this.body);
	},
	
	_resolveRef: function (ref) {
		var list = this.params, i, v,
		l = list.length;
		for (i = 0; i<l; i++) {
			v = list[i];
			if (v.name === name) {
				ref.attr = v;
				return;
			}
		}
	}
});

var inferFunctionName = function (node, id) {
	if (node.type === REFERENCE &&
		node.attr instanceof Func &&
		!node.attr.inferredName)
		node.attr.inferredName = id;
};

var Program = extend(FuncBase);

var Func = extend(FuncBase, {
	decl: 0
});

var varIdCounter = 0;

var Variable = extend(Object, {
	id: 0,
	name: "",
	value: null,
	scope: null,
	builtin: 0,
	
	__init__: function () {
		this.id = ++varIdCounter;
		this.scope = scope;
		scope.varMap[this.id] = this;
	}
});

var TypeToString = [""];

var addType = function (str) {
	return TypeToString.push(str) - 1;
};

iter = 0;
var NODE = addType("node"),
CONSTANT = addType("constant"),
REFERENCE = addType("ref"),
PARAM = addType("param"),
OBJECT_LITERAL = addType("object_literal"),
ARRAY_LITERAL = addType("array_literal"),
NATIVE = addType("native"),
NATIVE_FUNC = addType("native_func"),
CALL = addType("call"),
MEMBER = addType("member"),
UNARY = addType("unary"),
BINARY = addType("binary"),
ASSIGN = addType("assign"),
EXPR_LIST = addType("expr_list"),
BREAK = addType("break"),
CONTINUE = addType("continue"),
RETURN = addType("return"),
THROW = addType("throw"),
DEBUGGER = addType("debugger"),
BLOCK = addType("block"),
BRANCH = addType("branch"),
IF = addType("if"),
IF_ELSE = addType("if_else"),
WHILE = addType("while"),
DO_WHILE = addType("do_while"),
FOR = addType("for"),
FOR_IN = addType("for_in"),
HAS_PROPERTY = addType("has_property"),
GET_PROPERTY_OF = addType("get_property_of"),
FUNC = addType("func"),
FUNC_HEAD = addType("func_head"),
FUNC_REF = addType("func_ref");

var isAbruption = listToTable([BREAK, CONTINUE, RETURN, THROW]);
var isLoop = listToTable([WHILE, DO_WHILE, FOR, FOR_IN]);
var isBreakable = derive(isLoop, listToTable([IF, IF_ELSE, BLOCK]));
var isBranch = derive(isLoop, listToTable([IF, IF_ELSE]));

iter = 0;
var isLoopHead = 1 << iter++,
isFuncRef = 1 << iter++;

var Node = extend(Object, {
	id: 0,
	cfgId: 0,
	type: 0,
	vType: -1,
	children: null,
	parent: null,
	succ: null,
	pred: null,
	attr: null,
	labels: null,
	
	flags: 0,
	dominator: null,
	postDominator: null,
	value: null,
	definition: null,
	usedBy: null,
	condition: null,
	controlDep: null,
	controlDepNeg: null,
	
	__init__: function (type) {
		var args = slice.call(arguments, 1);
		this.id = ++scope.nodeIdCounter;
		scope.nodeIdMap[this.id] = this;
		this.type = type;
		this.vType = -1;
		this.children = [];
		this.parent = null;
		this.succ = [];
		this.pred = [];
		this.flags = 0;
		this.value = this;
		this.usedBy = [];
		this.controlDep = [];
		this.controlDepNeg = [];
		addChildren(this, args);
	},
	
	toString: function () {
		return TypeToString[this.type] + "(" + this.id + ")";
	}
});

var getFirst = function (node) {
	var c;
	while (true) {
		c = node.children;
		if (c.length === 0) {
			return node;
		}
		node = c[0];
	}
};

var addChild = function (node, child) {
	node.children.push(child);
	child.parent = node;
};

var addChildren = function (node, children) {
	var i, l = children.length;
	for (i = 0; i<l; i++) {
		addChild(node, children[i]);
	}
};

var connect = function (pred, succ) {
	pred.succ.push(succ);
	succ.pred.push(pred);
	if (succ.cfgId === 0) {
		succ.cfgId = ++scope.cfgIdCounter;
		scope.nodeList.push(succ);
	}
};

var CFG = function (prev, node) {
	var pending = [node], i, c;
	while (pending.length > 0) {
		node = pending.pop();
		if (node === 0) {
			i = 0;
			node = pending.pop();
		} else {
			c = node.children;
			i = c.length;
		}
		if (i === 0) {
			if (prev) connect(prev, node);
			prev = node;
			if (isAbruption[node.type]) {
				lookupTarget(node);
				return 0;
			} else if (node.type === REFERENCE &&
				typeof node.attr === "string") {
				scope.resolveRef(node);
			}
		} else {
			if (isBranch[node.type]) {
				if (!CFGBranch(prev, node)) return 0;
				prev = node;
			} else {
				pending.push(node, 0);
				while (i--) pending.push(c[i]);
			}
		}
	}
	return 1;
};

var CFGSeq = function (prev, tree, end) {
	if (CFG(prev, tree)) connect(tree, end);
};

var CFGIf = function (prev, node) {
	var c = node.children, cond = c[0];
	if (!CFG(prev, cond)) return 0;
	CFGSeq(cond, c[1], node);
	connect(cond, node);
	return node.pred.length > 0;
};

var CFGIfElse = function (prev, node) {
	var c = node.children, cond = c[0];
	if (!CFG(prev, cond)) return 0;
	CFGSeq(cond, c[1], node);
	CFGSeq(cond, c[2], node);
	return node.pred.length > 0;
};

var CFGWhile = function (prev, node) {
	var c = node.children, cond = c[0];
	if (!CFG(prev, cond)) return 0;
	CFGSeq(cond, c[1], getFirst(cond));
	connect(cond, node);
	return node.pred.length > 0;
};

var CFGDoWhile = function (prev, node) {
	var c = node.children,
	sequent = c[0], cond = c[1],
	ret;
	
	if (CFG(prev, sequent)) {
		ret = CFG(sequent, cond);
	} else if (cond.pred.length > 0) {
		ret = CFG(null, cond);
	} else return 0;
	
	if (ret) {
		connect(cond, getFirst(sequent));
		connect(cond, node);
	}
	
	return node.pred.length > 0;
};

var CFGBranch = function (prev, node) {
	var type = node.type;
	if (type === IF) return CFGIf(prev, node);
	if (type === IF_ELSE) return CFGIfElse(prev, node);
	if (type === WHILE) return CFGWhile(prev, node);
	if (type === DO_WHILE) return CFGDoWhile(prev, node);
};

var lookupTarget = function (node) {
	var type;
	if (node.succ.length === 0) {
		type = node.type;
		if (type === BREAK) return lookupBreakTarget(node);
		if (type === CONTINUE) return lookupContinueTarget(node);
		if (type === THROW) return lookupThrowTarget(node);
		if (type === RETURN) {
			connect(node, scope.body);
			return scope.body;
		}
	}
	return node.succ[0];
};

var lookupBreakTarget = function (node) {
	var ancestor = node.parent, label = node.attr;
	while (ancestor) {
		type = ancestor.type;
		if (label? isBreakable[type] &&
					ancestor.labels &&
					ancestor.labels.indexOf(label) >= 0:
				isLoop[type]) {
			connect(node, ancestor);
			return ancestor;
		}
		ancestor = ancestor.parent;
	}
	raise("Target not found");
};

var lookupContinueTarget = function (node) {
	var ancestor = node.parent, label = node.attr, target;
	while (ancestor) {
		type = ancestor.type;
		if (isLoop[type] && (!label ||
					ancestor.labels &&
					ancestpr.labels.indexOf(label) >= 0)) {
			if (type === DO_WHILE) {
				target = ancestor.children[1];
			} else {
				target = ancestor.children[0];
			}
			target = getFirst(target);
			connect(node, target);
			return target;
		}
		ancestor = ancestor.parent;
	}
	raise("Target not found");
};

var lookupThrowTarget = function (node) {
	connect(node, scope.body);
	return scope.body;
};

var Empty = function () {
	return new Node(NODE);
};

var Branch = function (cond, parentType) {
	var node = new Node(BRANCH, cond);
	node.attr = parentType;
	return node;
};

var If = function (cond, sequent) {
	return new Node(IF, Branch(cond, IF), sequent);
};

var IfElse = function (cond, sequent, alternate) {
	return new Node(IF_ELSE, Branch(cond, IF_ELSE), sequent, alternate);
};

var While = function (cond, body) {
	getFirst(cond).flags |= isLoopHead;
	return new Node(WHILE, Branch(cond, WHILE), body);
};

var DoWhile = function (body, cond) {
	getFirst(body).flags |= isLoopHead;
	return new Node(DO_WHILE, body, Branch(cond, DO_WHILE));
};

var Break = function (label) {
	var node = new Node(BREAK);
	node.attr = label || "";
	return node;
};

var Continue = function (label) {
	var node = new Node(CONTINUE);
	node.attr = label || "";
	return node;
};

var Return = function (value) {
	return new Node(RETURN, value);
};

var Throw = function (value) {
	return new Node(RETURN, value);
};

var Debugger = function () {
	return new Node(DEBUGGER);
};

var Constant = function (v) {
	var node = new Node(CONSTANT);
	node.attr = v;
	return node;
};

var Reference = function (_var) {
	var node = new Node(REFERENCE);
	node.attr = _var;
	return node;
};

var Param = function (_var) {
	var node = new Node(PARAM);
	node.attr = _var;
	return node;
};

var ObjectLiteral = function (obj) {
	var node = new Node(OBJECT_LITERAL), key, prop;
	for (key in obj) {
		prop = obj[key];
		if (prop.value) {
			addChild(node, prop.value);
		} else {
			if (prop.get) {
				addChild(node, prop.get);
			}
			if (prop.set) {
				addChild(node, prop.set);
			}
		}
	}
	node.attr = obj;
	return node;
};

var ArrayLiteral = function (array) {
	var node = new Node(ARRAY_LITERAL);
	addChildren(node, array);
	node.attr = array;
	return node;
};

var Unary = function (op, operand) {
	if (op === 9) return IncDec(operand, 1, 1);
	if (op === 10) return IncDec(operand, 1, 0);
	if (op === 4) return IncDec(operand, 0, 1);
	if (op === 5) return IncDec(operand, 0, 0);
	
	var t, node = new Node(UNARY, operand);
	node.attr = op;
	return node;
};

var UnaryEval = {};

var _unaryEvalCode = {
	"+x": "+x",
	"-x": "-x",
	"~": "~x",
	"!": "!x",
	"delete": "delete x",
	"typeof": "typeof x",
	"void": "void x"
};

["+x", "-x", "~", "!", "delete", "typeof", "void"].forEach(function (opName) {
	UnaryEval[opTable[opName]] = new Function("x", "return " + _unaryEvalCode[opName] + ";");
});

var Binary = function (op, first, second) {
	var node = new Node(BINARY, first, second);
	node.attr = op;
	return node;
};

var BinaryEval = {};

["*", "/", "%", "+", "-", "<<", ">>", ">>>", "<", ">",
"<=", ">=", "==", "!=", "===", "!==", "&", "^", "|",
"&&", "||", "instanceof", "in"].forEach(function (opName) {
	BinaryEval[opTable[opName]] = new Function("x", "y", "return x " + opName + " y");
});

var Member = function (obj, prop) {
	return new Node(MEMBER, obj, prop);
};

var Assign = function (lhs, rhs) {
	return new Node(ASSIGN, lhs, rhs);
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

var CompoundAssign = function (op, lhs, rhs) {
	var o, p, o2, p2, t1, t2, list;
	op = assignOperatorTable[op];
	if (lhs.type === REFERENCE) {
		return Assign(lhs, Binary(op, Reference(lhs.attr), rhs));
	} else if (lhs.type === MEMBER) {
		o = lhs.children[0];
		p = lhs.children[1];
		list = [];
		if (o.type === REFERENCE) {
			o2 = Reference(o.attr);
		} else {
			t1 = scope.localVar();
			list.push(Assign(Reference(t1), o));
			o2 = Reference(t1);
		}
		if (p.type === CONSTANT) {
			p2 = Constant(p.attr);
		} else if (p.type === REFERENCE) {
			p2 = Reference(p.attr);
		} else {
			t2 = scope.localVar();
			list.push(Assign(Reference(t2), p));
			p2 = Reference(t2);
		}
		list.push(Assign(lhs, Binary(op, Member(o2, p2), rhs)));
		if (list.length === 1) return list[0];
		return ExprList(list);
	}
};

var IncDec = function (lhs, prefix, increment) {
	var expr = CompoundAssign(19 - increment, lhs, Constant(1));
	if (prefix === 0) {
		return Binary(18 + increment, expr, Constant(1));
	} else {
		return expr;
	}
};

var Call = function (fn, args) {
	var node = new Node(CALL, fn);
	addChildren(node, args);
	return node;
};

var New = function (fn, args) {
	var node = Call(fn, args);
	node.isNew = 1;
	return node;
};

var Block = function (stmts) {
	var node = new Node(BLOCK);
	addChildren(node, stmts);
	return node;
};

var ExprList = function (exprs) {
	var node = new Node(EXPR_LIST);
	addChildren(node, exprs);
	return node;
};

var Native = function (obj) {
	var type = typeof obj;
	if (type === "string" || type === "number" ||
		type === "boolean" || type === "undefined" ||
		obj === null) {
		return Constant(obj);
	} else if (type === "object") {
		node = new Node(NATIVE);
		node.attr = obj;
		return node;
	} else if (type === "function") {
		return NativeFunc(obj);
	} else {
		raise("unknown type");
	}
};

var NativeFunc = function (func) {
	var node = new Node(NATIVE_FUNC);
	node.attr = func;
	return node;
};

var For = function (init, cond, update, body, labels) {
	var _while = While(cond, Block(body, update));
	_while.labels = labels;
	return Block(init, _while);
};

var HasProperty = function (object) {
	return new Node(HAS_PROPERTY, object);
};

var GetPropertyOf = function (object) {
	return new Node(GET_PROPERTY_OF, object);
};

var ForIn = function (lhs, object, body, labels) {
	var t = scope.localVar();
	var _while = While(HasProperty(Reference(t)),
		Block(Assign(lhs, GetPropertyOf(Reference(t))), body));
	_while.labels = labels;
	return Block(Assign(Reference(t), object), _while);
};

var _lhsUnaryOperator = opListToTable(["++x", "--x", "x++", "x--", "delete"]);

var isLHS = function (node) {
	var type = node.type, parent, parentType;
	if (type === REFERENCE || type === MEMBER) {
		parent = node.parent;
		parentType = parent.type;
		if ((parentType === ASSIGN ||
			parentType === CALL ||
			(parentType === UNARY &&
				_lhsUnaryOperator[parent.attr])) &&
			parent.children[0] === node) {
			console.log("irreplaceable", node);
			return 1;
		}
	}
	return 0;
};

var commonDom = function (a, b, stack, reverse) {
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

var getDominator = function (node, stack, reverse) {
	var preds, i, l, t = null, s;
	if (!reverse && node.dominator) return node.dominator;
	if (reverse && node.postDominator) return node.postDominator;
	
	preds = reverse? node.succ: node.pred;
	l = preds.length;
	if (!reverse && (node.flags & isLoopHead)) {
		t = preds[0];
	} else if (reverse && (stack.indexOf(node) >= 0 ||
			node.parent && node.parent.type === DO_WHILE)) {
		return preds[1];
	} else if (l > 0) {
		s = 0;
		if (reverse && node.type === BRANCH &&
			isLoop[node.attr]) {
			stack.push(node);
			s = 1;
		}
		t = preds[0];
		for (i = 1; i<l; i++) {
			t = commonDom(t, preds[i], stack, reverse);
		}
		if (s) {
			stack.pop();
		}
	}
	if (reverse) {
		node.postDominator = t;
	} else {
		node.dominator = t;
	}
	return t;
};

var computeDominators = function () {
	var list = scope.nodeList, i, l = list.length;
	for (i = 0; i<l; i++) {
		getDominator(list[i], [], 0);
	}
};

var computePostDominators = function () {
	var list = scope.nodeList, i = list.length;
	while (i--) {
		getDominator(list[i], [], 1);
	}
};

var dominate = function (a, b) {
	while (b) {
		if (a === b) return 1;
		b = b.dominator;
	}
	return 0;
};

var postDominate = function (a, b) {
	while (b) {
		if (a === b) return 1;
		b = b.postDominator;
	}
	return 0;
};

var walk = function (handler, node, visited) {
	if (!visited) visited = [];
	if (visited.indexOf(node) >= 0) return;
	
	visited.push(node);
	handler(node);
	
	var succs = node.succ, i, l = succs.length;
	for (i = 0; i<l; i++) {
		walk(handler, succs[i], visited);
	}
};

var _ReachDef = function (ref) {
	if (ref.type === REFERENCE && !isLHS(ref)) {
		var node,
		v,
		visited = [],
		pending = [ref];
		ref.definition = [];
		
		if (ref.type === REFERENCE && ref.attr.builtin) {
			ref.definition.push(ref.attr.value);
			return;
		}
		
		while (pending.length > 0) {
			node = pending.pop();
			if (visited.indexOf(node) >= 0) {
				continue;
			}
			visited.push(node);
			if (GetDefinition(node, ref)) {
				push.apply(pending, node.pred);
			}
		}
	}
};

var GetDefinition = function (node, ref) {
	var _var, obj, prop, op, t,
	type = node.type,
	c = node.children,
	lhs, rhs;
	if (ref.type === REFERENCE) {
		_var = ref.attr;
		if (type === ASSIGN) {
			lhs = c[0];
			if (lhs.type === REFERENCE && lhs.attr === _var) {
				AddDefinition(ref, c[1]);
				return 0;
			}
		} else if (type === UNARY) {
			op = node.attr;
			if (op === 4 ||
				op === 5 ||
				op === 9 ||
				op === 10) {
				AddDefinition(ref, node);
				return 0;
			}
		} else if (type === FUNC_HEAD) {
			rhs = scope.initValues[_var.id];
			if (!rhs) {
				if (ref.flags & isFuncRef) {
					rhs = new Node(FUNC_REF);
					rhs.attr = ref.attr;
				} else if (scope.locals.indexOf(_var) >= 0) {
					rhs = Constant(undefined);
				} else {
					rhs = Param(_var);
				}
				scope.initValues[_var.id] = rhs;
			}
			AddDefinition(ref, rhs);
			return 0;
		}
	}
};

var AddDefinition = function (ref, def) {
	ref.definition.push(def);
	def.usedBy.push(ref);
};

var ReachDef = function () {
	walk(_ReachDef, scope.head);
};

var _ControlDep = function (node) {
	var pdom = node,
	preds = node.pred, i, l = preds.length, pred;
	while (pdom) {
		for (i = 0; i<l; i++) {
			pred = preds[i];
			if (pdom != pred && !postDominate(pdom, pred)) {
				if (pred.succ[0] === node) {
					pdom.controlDep.push(pred);
				} else if (pred.succ[1] === node) {
					pdom.controlDepNeg.push(pred);
				}
			}
		}
		pdom = pdom.postDominator;
	}
};

var ControlDep = function () {
	walk(_ControlDep, scope.head);
};

var replace = function (node, replacer) {
	var list, i, succ, l, p;
	succ = replacer.succ = node.succ;
	node.succ = [];
	
	l = succ.length;
	for (i = 0; i<l; i++) {
		list = succ[i].pred;
		list[list.indexOf(node)] = replacer;
	}
	
	connect(node, replacer);
	
	p = node.parent;
	list = p.children;
	list[list.indexOf(node)] = replacer;
	node.parent = null;
	replacer.parent = p;
	
	return replacer;
};

var _hasSideEffect = derive(isAbruption, listToTable([CALL, ASSIGN]));
var HasSideEffect = function (node) {
	if (_hasSideEffect[node.type]) {
		return 1;
	} else {
		var c = node.children, i, l = c.length;
		for (i = 0; i<l; i++) {
			if (HasSideEffect(c[i])) return 1;
		}
		return 0;
	}
};

var Unknown = {};

var getValue = function (node) {
	var def, newNode;
	if (node.type === CONSTANT) {
		return node.attr;
	} else if (node.type === REFERENCE) {
		def = node.definition;
		if (def.length === 1 &&
			def[0].type === CONSTANT) {
			return def[0].attr;
		}
	}
	return Unknown;
};

var ToBoolean = function (node) {
	var v = getValue(node);
	
	var t = TypeInfer(node);
	if ((t & (TYPE_ALL ^ TYPE_OBJECT ^ TYPE_FUNCTION)) === 0) {
		return true;
	} else if ((t & (TYPE_ALL ^ TYPE_NULL ^ TYPE_UNDEFINED)) === 0) {
		return false;
	}
	return Unknown;
};

var _integerOperator = opListToTable(["<<", ">>", ">>>", "&", "^", "|"]),
_numberOperator = opListToTable(["++x", "--x", "x++", "x--", "+x", "-x", "*", "/", "%", "+", "-"]),
_booleanOperator = opListToTable(["<", ">", "<=", ">=", "==", "!=", "===", "!==", "&&", "||", "instanceof", "in"]);

var ConstProp = function (node) {
	var a, b, t, def, type, attr, c;
	
	type = node.type;
	attr = node.attr;
	c = node.children;
	
	if (type === UNARY) {
		if (attr !== 6) {
			a = ConstProp(a);
			if (a.type === CONSTANT) {
				return replace(node, UnaryEval[attr](a));
			}
			if (!HasSideEffect(a)) {
				if (attr === 14) {
					t = ToBoolean(a);
					if (t !== Unknown) {
						return replace(node, Constant(!t));
					}
				} else if (attr === 7) {
					return replace(node, Constant(undefined));
				} else if (attr === 8) {
					t = TypeInfer(a);
					if (t === 0) raise("invalid");
					if ((t & (TYPE_ALL ^ TYPE_NUMBER)) === 0) {
						return replace(node, Constant("number"));
					} else if ((t ^ TYPE_STRING) === 0) {
						return replace(node, Constant("string"));
					} else if ((t ^ TYPE_BOOLEAN) === 0) {
						return replace(node, Constant("boolean"));
					} else if ((t ^ TYPE_UNDEFINED) === 0) {
						return replace(node, Constant("undefined"));
					} else if ((t ^ TYPE_FUNCTION) === 0) {
						return replace(node, Constant("function"));
					} else if ((t & (TYPE_ALL ^ TYPE_OBJECT ^ TYPE_NULL)) === 0) {
						return replace(node, Constant("object"));
					}
				}
			}
		}
	} else if (type === BINARY) {
		if (attr !== 27 && attr !== 28) {
			a = ConstProp(c[0]);
			b = ConstProp(c[1]);
			if (a.type === CONSTANT && b.type === CONSTANT) {
				return replace(node, BinaryEval[attr](a, b));
			}
		}
	} else if (type === REFERENCE) {
		def = node.definition;
		if (def.length === 1) {
			return ConstProp(def[0]);
		}
	}
	return node;
};

var TypeInfer = function (node, noCache) {
	var type, attr, c, t = 0, t1, t2, a, b, list, i, l;
	
	if (!noCache && node.vType >= 0) {
		return node.vType;
	}
	node.vType = 0;
	type = node.type;
	c = node.children;
	if (type === CONSTANT) {
		attr = node.attr;
		if (typeof attr === "number") {
			if (~~attr === attr) {
				t = TYPE_INTEGER;
			} else if (!isFinite(attr)) {
				t = TYPE_NON_FINITE;
			} else {
				t = TYPE_FLOAT;
			}
		} else if (attr === null) {
			t = TYPE_NULL;
		} else if (attr instanceof RegExp) {
			t = TYPE_REGEXP;
		} else {
			t = typeTable[typeof attr];
		}
	} else if (type === UNARY) {
		attr = node.attr;
		if (_numberOperator[attr]) {
			a = TypeInfer(c[0]);
			t = a & TYPE_NUMBER;
			if (a ^ TYPE_NUMBER) {
				t |= TYPE_NUMBER;
			}
		} else if (attr === 13) {
			t = TYPE_INTEGER;
		} else if (attr === 14) {
			t = TYPE_BOOLEAN;
		}
	} else if (type === BINARY) {
		attr = node.attr;
		a = TypeInfer(c[0]);
		b = TypeInfer(c[1]);
		if (_numberOperator[attr]) {
			t1 = TYPE_ALL ^ TYPE_UNDEFINED ^ TYPE_NON_FINITE ^ TYPE_STRING;
			if ((a & t1) && (b & t1)) {
				t |= TYPE_INTEGER | TYPE_NON_FINITE;
				t1 = t1 ^ TYPE_INTEGER;
				if (attr === 16 || (a & t1) || (b & t1)) {
					t |= TYPE_FLOAT;
				}
			}
			
			t2 = TYPE_NON_FINITE | TYPE_UNDEFINED;
			t1 |= t2;
			if ((a & t1) && (b & t1) &&
				(a & t2 | b & t2)) {
				t |= TYPE_NON_FINITE;
			}
			
			if (attr === 18) {
				t1 = TYPE_STRING | TYPE_OBJECT;
				if (a & t1 | b & t1) {
					t |= TYPE_STRING;
				}
			}
		} else if (_integerOperator[attr]) {
			t = TYPE_INTEGER;
		} else if (_booleanOperator[attr]) {
			t = TYPE_BOOLEAN;
		}
	} else if (type === OBJECT_LITERAL) {
		t = TYPE_PURE_OBJECT;
	} else if (type === ARRAY_LITERAL) {
		t = TYPE_ARRAY;
	} else if (type === MEMBER) {
		t = TYPE_ALL;
	} else if (type === ASSIGN) {
		t = TypeInfer(c[1]);
	} else if (type === EXPR_LIST) {
		t = TypeInfer(c[c.length - 1]);
	} else if (type === IF_ELSE) {
		t = TypeInfer(c[1]) | TypeInfer(c[2]);
	} else if (type === HAS_PROPERTY) {
		t = TYPE_BOOLEAN;
	} else if (type === GET_PROPERTY_OF) {
		t = TYPE_STRING;
	} else if (type === REFERENCE) {
		if (!isLHS(node)) {
			list = node.definition;
			l = list.length;
			for (i = 0; i<l; i++) {
				t |= TypeInfer(list[i]);
			}
		}
	} else if (type === FUNC_REF) {
		t = TYPE_FUNCTION;
	} else if (type === RETURN) {
		return;
	} else {
		return;
	}
	
	if (t !== node.vType) {
		node.vType = t;
		TypeInfer(node.parent, 1);
		
		list = node.usedBy;
		l = list.length;
		for (i = 0; i<l; i++) {
			TypeInfer(list[i], 1);
		}
	}
	return t;
};

var EffectsAnalyse = function () {
	
};

var Analyse = function ($node, visited, lhs) {
	var node = ConstProp($node),
	type = node.type,
	c, i, l, n;
	
	if (visited.indexOf(node) >= 0) {
		console.log("visited " + node);
		return;
	}
	visited.push(node);
	
	console.log("analyse " + node);
	
	if (type === FUNC) {
		c = node.pred;
	} else if (type === REFERENCE && !lhs) {
		c = node.definition;
	} else if (type === ASSIGN) {
		analyse(node.children[0], visited, true);
		analyse(node.children[1], visited);
	} else {
		c = node.children;
	}
	
	if (c) {
		l = c.length;
		for (i = 0; i<l; i++) {
			analyse(c[i], visited);
		}
	}
	
	c = node.controlDep;
	l = c.length;
	for (i = 0; i<l; i++) {
		n = c[i];
		analyse(n, visited);
	}
};


var dump = function (node, visited) {
	if (!visited) {
		visited = [];
	}
	if (visited.indexOf(node) >= 0) {
		return;
	}
	visited.push(node);
	
	console.log(
		node +
		",\tdom: " + node.dominator +
		",\tpdom: " + node.postDominator +
		",\tdef: " + (node.definition && node.definition.join("; ")) +
		",\tcontrolDep: " + node.controlDep.join("; ") +
		",\tcontrolDepNeg: " + node.controlDepNeg.join("; ")
	);
	
	var succs = node.succ, i, l = succs.length;
	for (i = 0; i<l; i++) {
// 		console.log(node + "\t=>\t" + succs[i]);
		dump(succs[i], visited);
	}
};

new Scope();
