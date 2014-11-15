var parser = (function () {
	var text, length, pos, value, spaceStart, spaceEnd, hasLineTerminator;
	var stack = [];
	
	var save = function () {
		stack.push([text, length, pos, value, spaceStart, spaceEnd, hasLineTerminator]);
	};
	
	var restore = function () {
		var frame = stack.pop();
		text = frame.shift();
		length = frame.shift();
		pos = frame.shift();
		value =  frame.shift();
		spaceStart = frame.shift();
		spaceEnd = frame.shift();
		hasLineTerminator = frame.shift();
	};
	
	var raise = function (msg) {
		throw new Error(msg + " at " + pos);
	};
	
	var match = function (code) {
		if (text.charCodeAt(pos) === code) {
			pos++; space();
			return 1;
		} else return 0;
	};
	
	var expect = function (code) {
		if (text.charCodeAt(pos) !== code)
			raise("expected " + String.fromCharCode(code));
		else pos++; space();
	};
	
	var matchIdent = function (ident) {
		var l = ident.length, i = 0, p = pos;
		while (i < l) {
			if (text.charCodeAt(p) !== ident.charCodeAt(i))
				return 0;
			i++; p++;
		}
		if (isIdentifierChar(text.charCodeAt(p)))
			return 0;
		pos = p; space();
		return 1;
	};
	
	var expectIdent = function (ident) {
		var l = ident.length;
		if (text.substr(pos, l) === ident &&
			!isIdentifierChar(text.charCodeAt(pos + l))) {
			pos += l;
			space();
		} else raise("expected " + ident);
	};
	
	var parseIdentifier = function () {
		var ch = text.charCodeAt(pos), p = pos;
		if (ch >= 97? ch <= 122: ch <= 90?
			ch >= 65 || ch === 36: ch === 95) {
			ch = text.charCodeAt(++pos);
			while (pos < length &&
				ch >= 97? ch <= 122: ch <= 90?
				ch >= 65 || (ch >= 48? ch <= 57: ch === 36): ch === 95)
				ch = text.charCodeAt(++pos);
			if (ch >= 0xaa) raise("nonASCII");
			else {
				value = text.substring(p, pos);
				space();
				return 1;
			}
		} else if (ch >= 0xaa) raise("nonASCII");
		else return 0;
	};
	
	var space = function () {
		var ch = text.charCodeAt(pos);
		spaceStart = pos;
		if (ch <= 32 || ch >= 160 || ch === 47) {
			_space(ch);
		}
	};
	
	var _space = function (ch) {
		var p = pos;
		hasLineTerminator = 0;
		while (p < length) {
			if (ch === 32) ++p;
			else if (ch === 47) {
				ch = text.charCodeAt(p + 1);
				if (ch === 42) {
					p = text.indexOf("*/", p + 2) + 2;
					if (p === 1) raise("unterminated comment");
				} else if (ch === 47) {
					++p;
					do ch = text.charCodeAt(++p);
					while (p < length && ch !== 13 && ch !== 10 &&
						ch !== 8232 && ch !== 8233);
					hasLineTerminator = 1;
					++p;
				} else break;
			} else if (ch > 13 && ch < 160) break;
			else if (ch === 9) ++p;
			else if (ch === 13 || ch === 10 || ch === 8232 || ch === 8233) {
				hasLineTerminator = 1;
				++p;
			} else if (ch === 11 || ch === 12 || ch === 160 ||
				(ch >= 5760 && nonASCIIwhitespace.test(text[p])))
				++p;
			else break;
			ch = text.charCodeAt(p);
		}
		spaceEnd = pos = p;
	};
	
	var semicolon = function () {
		if (!match(59) &&
			!(text.charCodeAt(pos) === 125 ||
			spaceEnd === pos && hasLineTerminator ||
			pos >= length))
			raise("missing semicolon");
	};
	
	var parseSourceElements = function (endChar) {
		var stmts = [], l;
		while (pos < length && text.charCodeAt(pos) !== endChar) {
			stmts.push(parseStatement());
		}
		l = stmts.length;
		return l === 0? Empty(): l === 1? stmts[0]: Block(stmts);
	};
	
	var parseBlock = function (labels) {
		var block = parseSourceElements(125);
		expect(125);
		block.labels = labels;
		return block;
	};
	
	var parseStatement = function (labels, hasId) {
		if (hasId || parseIdentifier()) {
			if (statementTableKeys[value] === 1)
				return statementTable[value](labels);
			if (match(58)) return parseLabelledStatement();
			return parseExpressionStatement(1);
		}
		if (match(123)) return parseBlock(labels);
		if (match(59)) return null;
		return parseExpressionStatement(0);
	};
	
	var parseExpressionStatement = function (hasId) {
		var e = parseExpression(hasId);
		semicolon();
		return e;
	};
	
	var parseLabelledStatement = function () {
		var labels = [], hasId;
		do {
			checkId(value);
			labels.push(value);
			hasId = parseIdentifier();
		} while (hasId && match(58));
		return parseStatement(labels, hasId);
	};
	
	var parseFunctionDecl = function () {
		parseFunctionWithName(1);
		return null;
	};
	
	var parseFunctionWithName = function (decl) {
		var func = new Func();
		func.decl = decl || 0;
		if (parseIdentifier()) func.name = func.inferredName = value;
		else if (decl) raise("expected function name");
		parseFunction(func);
		return func;
	};
	
	var parseFunction = function (func) {
		parseParams(func);
		expect(123);
		func.setBody(parseSourceElements(125));
		expect(125);
		return func;
	};
	
	var parseParams = function (func) {
		var param;
		expect(40);
		if (!match(41)) {
			while (true) {
				if (!parseIdentifier())
					raise("expected identifier");
				checkId(value);
				param = new Variable();
				param.name = value;
				func.params.push(param);
				if (match(41)) break;
				expect(44);
			}
		}
	};
	
	var parseIf = function (labels) {
		var sequent, alternate, cond;
		expect(40);
		cond = parseExpression();
		expect(41);
		
		sequent = parseStatement(labels);
		if (matchIdent("else")) {
			alternate = parseStatement(labels);
			return IfElse(cond, sequent, alternate);
		} else
			return If(cond, sequent);
	};
	
	var parseWhile = function (labels) {
		var cond, body, node;
		expect(40);
		cond = parseExpression();
		expect(41);
		body = parseStatement();
		node = While(cond, body);
		node.labels = labels;
		return node;
	};
	
	var parseDoWhile = function (labels) {
		var cond, body, node;
		body = parseStatement();
		expectIdent("while");
		expect(40);
		cond = parseExpression();
		expect(41);
		semicolon();
		node = DoWhile(body, cond);
		node.labels = labels;
		return node;
	};
	
	var parseFor = function (labels) {
		var expr;
		expect(40);
		
		if (text.charCodeAt(pos) === 59)
			return parseForLoop(Empty(), labels);
		
		if (matchIdent("var")) {
			save();
			expr = parseVarDecl(true);
			if (matchIdent("in")) {
				stack.splice(-2, 1);
				return parseForIn(expr, labels);
			} else {
				cacheParseVarDecl(expr, pos);
				restore();
				return parseForLoop(parseVarDeclList(null, 1), labels);
			}
		} else {
			expr = parseExpression(0, 1);
			if (matchIdent("in")) {
				if (expr.type !== REFERENCE &&
					expr.type !== MEMBER)
					raise("invalid lhs in for loop");
				return parseForIn(expr, labels);
			} else return parseForLoop(expr, labels);
		}
	};
	
	var cacheParseVarDecl = function (ret, p) {
		var old = parseVarDecl;
		parseVarDecl = function () {
			parseVarDecl = old;
			pos = p;
			return ret;
		};
	};
	
	var parseForIn = function (iterator, labels) {
		var object = parseExpression();
		expect(41);
		var body = parseStatement();
		return ForIn(iterator, object, body, labels);
	};
	
	var parseForLoop = function (init, labels) {
		var cond, update, body;
		expect(59);
		if (text.charCodeAt(pos) !== 59)
			cond = parseExpression();
		else cond = Constant(true);
		expect(59);
		if (text.charCodeAt(pos) !== 41)
			update = parseExpression();
		else update = Empty();
		expect(41);
		body = parseStatement();
		return For(init, cond, update, body, labels);
	};
	
	var parseBreak = function (labels) {
		var label;
		if (parseIdentifier() &&
			(spaceEnd !== pos || hasLineTerminator === 0)) {
			label = value;
			if (labels && labels.indexOf(label) >= 0) {
				semicolon();
				return null;
			}
		} else label = "";
		semicolon();
		return Break(label);
	};
	
	var parseContinue = function () {
		var label;
		if (parseIdentifier() &&
			(spaceEnd !== pos || hasLineTerminator === 0)) {
			label = value;
		} else label = "";
		semicolon();
		return Continue(label);
	};
	
	var parseReturn = function () {
		var value;
		if (!(scope instanceof Func))
			raise("invalid return");
		if (match(59) ||
			spaceEnd === pos && hasLineTerminator ||
			pos === length ||
			text.charCodeAt(pos) === 125) {
			value = Constant(undefined);
		} else {
			value = parseExpression();
			semicolon();
		}
		return Return(value);
	};
	
	var parseThrow = function () {
		if (spaceEnd === pos && hasLineTerminator)
			raise("expected expression");
		else {
			var value = parseExpression();
			semicolon();
			return Throw(value);
		}
	};
	
	var parseVarDeclList = function (labels, noIn) {
		var list = [], expr, l;
		expr = parseVarDecl(noIn);
		if (expr) list.push(expr);
		while (match(44)) {
			expr = parseVarDecl(noIn);
			if (expr) list.push(expr);
		}
		l = list.length;
		if (l === 0) return null;
		if (l === 1) return list[1];
		return ExprList(list);
	};
	
	var parseVarDecl = function (noIn) {
		var expr, _var = scope.localVar();
		if (!parseIdentifier()) raise("expected identifier");
		checkId(value);
		_var.name = value;
		if (match(61)) {
			expr = parseAssignmentExpression(0, noIn);
			return Assign(Reference(_var), expr);
		} else {
			return null;	
		}
	};
	
	var parseDebugger = function () {
		semicolon();
		return Debugger();
	};
	
	var parseNumericLiteral = function () {
		var p = pos, ch, t, integerOrFraction = 0;
		ch = text.charCodeAt(pos);
		if (ch === 48) {
			ch = text.charCodeAt(++pos);
			if (ch === 88 || ch === 120) {
				do ch = text.charCodeAt(++pos);
				while (pos < length &&
					((ch >= 48 && ch <= 57) ||
					(ch >= 65 && ch <= 70) ||
					(ch >= 97 && ch <= 102)));
				t = Constant(parseInt(text.substring(p, pos)));
				space();
				return t;
			}
			integerOrFraction = 1;
			ch = text.charCodeAt(pos);
		}
		
		if (ch >= 48 && ch <= 57) {
			integerOrFraction = 1;
			do ch = text.charCodeAt(++pos);
			while (pos < length && ch >= 48 && ch <= 57);
		}
		
		return parseNumericLiteral2(p, integerOrFraction);
	};
		
	var parseNumericLiteral2 = function (p, integerOrFraction) {
		var ch = text.charCodeAt(pos), t;
		if (ch === 46) {
			ch = text.charCodeAt(++pos);
			if (ch >= 48 && ch <= 57) {
				do ch = text.charCodeAt(++pos);
				while (pos < length && ch >= 48 && ch <= 57);
			} else if (!integerOrFraction) raise("expected digit");
		} else if (!integerOrFraction) raise("expected digit or '.'");
		
		if (ch === 69 || ch === 101) {
			ch = text.charCodeAt(++pos);
			if (ch === 43 || ch === 45)
				ch = text.charCodeAt(++pos);
			if (ch >= 48 && ch <= 57)
				do ch = text.charCodeAt(++pos);
				while (pos < length && ch >= 48 && ch <= 57);
			else if (!integerOrFraction) raise("expected digit");
		}
		
		t = Constant(parseFloat(text.substring(p, pos)));
		space();
		return t;
	};
	
	var readHex = function () {
		var h = text.charCodeAt(++pos);
		if (h >= 48 && h <= 57) return h - 48;
		if (h >= 65 && h <= 70) return h - 55;
		if (h >= 97 && h <= 102) return h - 87;
		raise("invalid hex digit '" + String.fromCharCode(h) + "'");
	};
	
	var parseStringLiteral = function () {
		var ch, mark, s = [];
		mark = ch = text.charCodeAt(pos);
		if (ch !== 34 && ch !== 39) raise("unexpected");
		while (++pos < length) {
			ch = text.charCodeAt(pos);
			if (ch === mark) {
				pos++; space();
				return Constant(s.join(""));
			} else if (ch === 92) {
				if (pos >= length) raise("unexpected end of string");
				s.push(parseStringEscape());
			} else s.push(text.charAt(pos));
		}
		raise("expected '\"'");
	};
	
	var parseStringEscape = function () {
		var ch = text.charCodeAt(++pos);
		if (ch < 117) {
			if (ch === 110) return "\n";
			if (ch === 116) return "\t";
			if (ch === 114) return "\r";
			if (ch === 48) return "\0";
			if (ch === 98) return "\b";
			if (ch === 102) return "\f";
		} else {
			if (ch === 120)
				return String.fromCharCode((readHex()<<4) | readHex());
			if (ch === 117)
				return String.fromCharCode((readHex()<<12) | (readHex()<<8) | (readHex()<<4) | readHex());
			if (ch !== 13 && ch !== 10 && ch !== 8232 || ch !== 8233)
				return text.charAt(pos);
			if (ch === 118) return "\v";
		}
	};
	
	var parseRegularExpression = function () {
		var ch, expr, flags, p = pos, p2, inClass = 0, escaped = 0;
		if (text.charCodeAt(pos++) !== 47) raise("expected '/'");
		while (true) {
			ch = text.charCodeAt(pos);
			if (pos >= length || ch === 13 || ch === 10 || ch === 8232 || ch === 8233) {
				raise("expected '/'");
			} else if (!escaped) {
				if (ch === 47 && !inClass) break;
				if (ch === 91) inClass = 1;
				else if (ch === 93  && inClass) inClass = 0;
				else if (ch === 92) escaped = 1;
			} else escaped = 0;
			pos++;
		}
		expr = text.substring(p, pos);
		ch = text.charCodeAt(++pos);
		p2 = pos;
		while (pos < length &&
			(ch === 103 || ch === 105 || ch === 109 || ch === 115 || ch === 121)) {
			ch = text.charCodeAt(++pos);
		}
		flags = text.substring(p2, pos);
		space();
		return Constant(new RegExp(expr, flags));
	};
	
	var parseArrayLiteral = function () {
		var array = [];
		expect(91);
		while (pos < length) {
			if (match(44)) array.length++;
			else array.push(parseAssignmentExpression());
			if (match(93)) {
				return ArrayLiteral(array);
			}
			expect(44);
		}
		raise("expected ']'");
	};
	
	var parseObjectLiteral = function () {
		var obj = {}, comma;
		expect(123);
		while (pos < length) {
			parseProperty(obj);
			comma = match(44);
			if (match(125)) {
				return ObjectLiteral(obj);
			}
			comma || raise("expected ','");
		}
		raise("expected '}'");
	};
	
	var _msg = "Object literal may not have multiple get/set accessors with the same name";
	var parseProperty = function (obj) {
		var id, v, hasId = parseIdentifier();
		if (hasId && (value === "get" || value === "set") &&
			text.charCodeAt(pos) !== 58)
			return parseGetterSetter(value);
		id = hasId? value: parsePropertyName();
		v = parseAssignmentExpression();
		expect(58);
		getPropFromObj(obj, id).value = v;
		inferFunctionName(v, id);
	};
	
	var parseGetterSetter = function (value) {
		var id = parsePropertyName(),
			prop = getPropFromObj(obj, id),
			f = parseFunction();
		f.inferredName = value + " " + id;
		if (prop[value]) raise(_msg);
		prop[value] = Reference(f);
	};
	
	var getPropFromObj = function (obj, id) {
		if (hasOwnProperty.call(obj, id)) return obj[id];
		var prop = obj[id] = {
			key: id,
			value: undefined,
			get: undefined,
			set: undefined
		};
		return prop;
	};
	
	var parsePropertyName = function () {
		var ch = text.charCodeAt(pos);
		if (ch === 34 || ch === 39)
			return parseStringLiteral().attr;
		if (ch >= 48 && ch <= 57)
			return String(parseNumericLiteral().attr);
		if (ch === 46)
			return String(parseNumericLiteral2(pos, 0).attr);
		if (parseIdentifier()) return value;
		raise("expected property name");
	};
	
	var parseArguments = function () {
		var args = [];
		if (match(41)) return args;
		while (pos < length) {
			args.push(parseAssignmentExpression());
			if (match(41)) return args;
			expect(44);
		}
		raise("expected ')'");
	};
	
	var parseAssignmentExpression = function (hasId, noIn) {
		var state = 1, lhs = 0, newCount = 0,
			expr, ch, op = 0, a, b, p, t,
			prefix = [], args,
			prevExpr, prevOp, precedence, prevPrecedence, stack = [];
		for (;;) {
			if (hasId || parseIdentifier()) {
				if (state) {
					if (hasId) hasId = 0;
					if (keywordsAndReservedWordsAndBadIds[value] !== 1)
						expr = Reference(value);
					else if (value === "this")
						expr = Reference(scope.vThis);
					else if (value === "true")
						expr = Constant(true);
					else if (value === "typeof")
						op = 8;
					else if (value === "function") {
						expr = Reference(parseFunctionWithName(0));
					} else if (value === "null")
						expr = Constant(null);
					else if (value === "false")
						expr = Constant(false);
					else if (value === "new") {
						lhs = 1;
						newCount++;
						continue;
					} else if (value === "delete")
						op = 6;
					else if (value === "void")
						op = 7;
					else raise(1);
				} else if (value === "instanceof")
					op = 27;
				else if (value === "in") {
					if (noIn) {
						pos = spaceStart - 2; op = 100;
					} else op = 28;
				} else op = 100;
			} else {
				ch = text.charCodeAt(pos);
				if (state) {
					if (ch < 47) {
						if (ch === 34 || ch === 39)
							expr = parseStringLiteral();
						else if (ch === 40) {
							pos++; space();
							expr = parseExpression();
							expect(41);
						} else if (ch === 43 || ch === 45) {
							if (text.charCodeAt(pos + 1) === ch)
								op = ch === 43? 9: 10;
							else op = ch === 43? 11: 12;
						} else if (ch === 46)
							expr = parseNumericLiteral2(pos, 0);
						else if (ch === 33)
							op = 14;
						else raise(2);
					} else if (ch === 126) op = 13;
					else
						expr = ch <= 57? parseNumericLiteral():
							ch === 91? parseArrayLiteral():
							ch === 123? parseObjectLiteral():
							ch === 47? parseRegularExpression():
							raise(3);
				} else if (ch < 47) {
					a = text.charCodeAt(pos + 1);
					if (ch < 41) {
						if (ch === 40) {
							pos++; space();
							args = parseArguments();
							if (newCount > 0) {
								newCount--;
								expr = New(expr, args);
							} else
								expr = Call(expr, args);
						} else
							op = ch === 38? a === 38? 36: a === 61? 47: 33:
								ch === 33? a === 61?
									text.charCodeAt(pos + 2) === 61? 32: 30: raise(4):
								ch === 37? a === 61? 41: 17: 100;
					} else if (ch === 46) {
						pos++; space();
						p = pos;
						if (!parseIdentifier()) raise("expected identifier");
						expr = Member(expr, Constant(value));
					} else 
						op = ch === 43?
							a === 43 && (spaceEnd !== pos || !hasLineTerminator)? 4:
								a === 61? 42: 18:
						ch === 45?
							a === 45 && (spaceEnd !== pos || !hasLineTerminator)? 5:
								a === 61? 43: 19:
						ch === 42? a === 61? 39: 15: 100;
				} else if (ch === 91) {
					pos++; space();
					t = parseExpression();
					expect(93);
					expr = Member(expr, t);
				} else {
					a = text.charCodeAt(pos + 1);
					b = text.charCodeAt(pos + 2);
					op = ch === 61?a === 61? b === 61? 31: 29: 38:
						ch === 60? a === 60? b === 61? 44: 20: a === 61? 25: 23:
						ch === 62? a === 62? b === 62?
							text.charCodeAt(pos + 3) === 61? 46: 22:
							b === 61? 45: 21: a === 61? 26: 24:
						ch === 63? 50:
						ch === 124? a === 124? 37: a === 61? 49: 35: 
						ch === 94? a === 61? 48: 34: 100;
				}
			}
			if (op === 0) {
				state = 0;
				continue;
			}
			while (newCount > 0) {
				expr = New(expr, []);
				newCount--;
			}
			if (op >= 6 && op <= 14) {
				lhs && raise("unexpected token");
				prefix.push(op);
			} else {
				if (op >= 15) {
					while (prefix.length > 0) {
						expr = Unary(prefix.pop(), expr);
					}
					
					precedence = precedenceTable[op];
					if (precedence === 12) {
						if (expr.type !== REFERENCE &&
							expr.type !== MEMBER) {
							raise("Invalid left-hand side in assignment");
						}
					} else {
						while (prevPrecedence <= precedence) {
							if (prevOp === 38) {
								expr = Assign(prevExpr, expr);
							} else if (prevOp >= 39 && prevOp <= 49) {
								expr = CompoundAssign(op, prevExpr, expr);
							} else {
								expr = Binary(op, prevExpr, expr);
							}
							prevPrecedence = stack.pop();
							prevOp = stack.pop();
							prevExpr = stack.pop();
						}
						if (op === 100) return expr;
						if (op === 50) {
							pos++; space();
							a = parseAssignmentExpression(0, noIn);
							expect(58);
							b = parseAssignmentExpression(0, noIn);
							expr = IfElse(expr, a, b);
							op = 0;
							continue;
						}
					}
					prevOp && stack.push(prevExpr, prevOp, prevPrecedence);
					prevExpr = expr;
					prevOp = op;
					prevPrecedence = precedence;
					state = 1;
				} else expr = Unary(op, expr);
			}
			pos += opLengthTable[op]; space();
			op = 0;
		}
	};
	
	var parseExpression = function (hasId, noIn) {
		var list = [];
		list.push(parseAssignmentExpression(hasId, noIn));
		while (match(44) && pos < length) {
			list.push(parseAssignmentExpression(0, noIn));
		}
		if (list.length === 1) return list[0];
		return ExprList(list);
	};
	
	var parseFor, parseSwitch, parseTry, parseWith;
	
	var statementTable = {
		"if": parseIf,
		"for": parseFor,
		"while": parseWhile,
		"do": parseDoWhile,
		"switch": parseSwitch,
		"try": parseTry,
		"with": parseWith,
		"var": parseVarDeclList,
		"return": parseReturn,
		"throw": parseThrow,
		"break": parseBreak,
		"continue": parseContinue,
		"debugger": parseDebugger,
		"function": parseFunctionDecl
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
	
	return function ($text, s) {
		save();
		text = $text;
		length = text.length;
		pos = 0;
		spaceStart = 0;
		spaceEnd = 0;
		hasLineTerminator = 0;
		space();
		var program = new Program();
		program.setBody(parseSourceElements());
		restore();
		return program;
	};
})();