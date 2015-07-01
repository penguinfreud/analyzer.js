var hasOwnProperty = Object.prototype.hasOwnProperty;
var push = Array.prototype.push;
var slice = Array.prototype.slice;
var _void = function () {};

var mixin = function (object, extension) {
	if (extension)
		for (var key in extension)
			if (hasOwnProperty.call(extension, key))
				object[key] = extension[key];
};

var derive = function (object, extension) {
	var result = Object.create(object);
	mixin(result, extension);
	return result;
};

var __super__ = function (Base, self, args) {
	Base.prototype.__init__.apply(self, args);
};

var extend = function (Base, extension) {
	var Constructor = function () {
		this.__init__.apply(this, arguments);
	};
	
	var proto = Constructor.prototype = derive(Base.prototype, extension);
	if (typeof proto.__init__ !== "function") {
		proto.__init__ = _void;
	}
	
	return Constructor;
};


var assert = function (cond, msg) {
	if (!cond) {
		throw new Error(msg || "Assertion failed");
	}
};

var warn = function (msg) {
	console.log(msg);
};

var raise = function (msg) {
	throw new Error(msg);
};

var listToTable = function (list) {
	var table = {}, i, l = list.length;
	for (i = 0; i<l; i++) table[list[i]] = 1;
	return table;
};

var opListToTable = function (list) {
	var table = {}, i, l = list.length;
	for (i = 0; i<l; i++) {
		table[opTable[list[i]]] = 1;
	}
	return table;
};

var print = function () {
	console.log.apply(console, arguments);
};

var iter;

iter = 0;
var TYPE_NONE = 0,
TYPE_INTEGER = 1 << (iter++),
TYPE_NON_FINITE = 1 << (iter++),
TYPE_FLOAT = 1 << (iter++),
TYPE_NUMBER = TYPE_INTEGER | TYPE_NON_FINITE | TYPE_FLOAT,
TYPE_UNDEFINED = 1 << (iter++),
TYPE_NULL = 1 << (iter++),
TYPE_BOOLEAN = 1 << (iter++),
TYPE_STRING = 1 << (iter++),
TYPE_ARRAY = 1 << (iter++),
TYPE_REGEXP = 1 << (iter++),
TYPE_PURE_OBJECT = 1 << (iter++),
TYPE_OBJECT = TYPE_ARRAY | TYPE_REGEXP | TYPE_PURE_OBJECT,
TYPE_FUNCTION = 1 << (iter++),
TYPE_ALL = TYPE_NONE | TYPE_UNDEFINED | TYPE_NULL | TYPE_BOOLEAN |
	TYPE_NUMBER | TYPE_STRING | TYPE_OBJECT | TYPE_FUNCTION;

var typeTable = {
	"undefined": TYPE_UNDEFINED,
	"boolean": TYPE_BOOLEAN,
	"number": TYPE_NUMBER,
	"string": TYPE_STRING,
	"object": TYPE_OBJECT,
	"function": TYPE_FUNCTION
};

iter = 0;
var opTable = {
	"[]": ++iter,
	"new": ++iter,
	"f(x)": ++iter,
	"x++": ++iter,
	"x--": ++iter,
	"delete": ++iter,
	"void": ++iter,
	"typeof": ++iter,
	"++x": ++iter,
	"--x": ++iter,
	"+x": ++iter,
	"-x": ++iter,
	"~": ++iter,
	"!": ++iter,
	"*": ++iter,
	"/": ++iter,
	"%": ++iter,
	"+": ++iter,
	"-": ++iter,
	"<<": ++iter,
	">>": ++iter,
	">>>": ++iter,
	"<": ++iter,
	">": ++iter,
	"<=": ++iter,
	">=": ++iter,
	"instanceof": ++iter,
	"in": ++iter,
	"==": ++iter,
	"!=": ++iter,
	"===": ++iter,
	"!==": ++iter,
	"&": ++iter,
	"^": ++iter,
	"|": ++iter,
	"&&": ++iter,
	"||": ++iter,
	"=": ++iter,
	"*=": ++iter,
	"/=": ++iter,
	"%=": ++iter,
	"+=": ++iter,
	"-=": ++iter,
	"<<=": ++iter,
	">>=": ++iter,
	">>>=": ++iter,
	"&=": ++iter,
	"^=": ++iter,
	"|=": ++iter,
	"?:": ++iter
};

opReverseTable = [];
for (var _key in opTable) {
	opReverseTable[opTable[_key]] = _key;
}

var precedenceTable = {
	15: 1,
	16: 1,
	17: 1,
	18: 2,
	19: 2,
	20: 3,
	21: 3,
	22: 3,
	23: 4,
	24: 4,
	25: 4,
	26: 4,
	27: 4,
	28: 4,
	29: 5,
	30: 5,
	31: 5,
	32: 5,
	33: 6,
	34: 7,
	35: 8,
	36: 9,
	37: 10,
	38: 12,
	39: 12,
	40: 12,
	41: 12,
	42: 12,
	43: 12,
	44: 12,
	45: 12,
	46: 12,
	47: 12,
	48: 12,
	49: 12,
	50: 11,
	100: 100
};

var opLengthTable = {
	4: 2, 
	5: 2, 
	6: 0, 
	7: 0, 
	8: 0, 
	9: 2, 
	10: 2, 
	11: 1, 
	12: 1, 
	13: 1, 
	14: 1, 
	15: 1, 
	16: 1, 
	17: 1, 
	18: 1, 
	19: 1, 
	20: 2, 
	21: 2, 
	22: 3, 
	23: 1, 
	24: 1, 
	25: 2, 
	26: 2, 
	27: 0, 
	28: 0, 
	29: 2, 
	30: 2, 
	31: 3, 
	32: 3, 
	33: 1, 
	34: 1, 
	35: 1, 
	36: 2, 
	37: 2, 
	38: 1, 
	39: 2, 
	40: 2, 
	41: 2, 
	42: 2, 
	43: 2, 
	44: 3, 
	45: 3, 
	46: 4, 
	47: 2, 
	48: 2, 
	49: 2, 
	50: 2,
	100: 0
};
