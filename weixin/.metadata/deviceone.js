(function (mod) {
    if (typeof exports == "object" && typeof module == "object") {
        return mod(require.main.require("../lib/infer"), require.main.require("../lib/tern"), require);
    }
    if (typeof define == "function" && define.amd)
        return define(["tern/lib/infer", "tern/lib/tern"], mod);
    mod(tern, tern);
})(function (infer, tern, require) {
    "use strict";
    function ResolvePath(base, path) {
        if (path[0] == "/")
            return path;
        var slash = base.lastIndexOf("/"),
            m;
        if (slash >= 0)
            path = base.slice(0, slash + 1) + path;
        while (m = /[^\/]*[^\/\.][^\/]*\/\.\.\//.exec(path))
            path = path.slice(0, m.index) + path.slice(m.index + m[0].length);
        return path.replace(/(^|[^\.])\.\//g, "$1");
    }

    function StringEndWith(that, str) {
        if (!that || !str || str.length > that.length)
            return false;
        return that.substring(that.length - str.length) == str;
    }

    function RelativePath(from, to) {
        if (from[from.length - 1] != "/")
            from += "/";
        if (to.indexOf(from) == 0)
            return to.slice(from.length);
        else
            return to;
    }

    function GetModule(data, name) {
        return data.modules[name] || (data.modules[name] = new infer.AVal);
    }

    function BuildWrappingScope(parent, origin, node) {
        var scope = new infer.Scope(parent);
        scope.originNode = node;
        infer.cx().definitions.deviceone.require.propagate(scope.defProp("require"));
        var module = new infer.Obj(infer.cx().definitions.deviceone.Module.getProp("prototype").getType());
        module.propagate(scope.defProp("module"));
        var exports = new infer.Obj(true, "exports");
        module.origin = exports.origin = origin;
        module.originNode = exports.originNode = scope.originNode;
        exports.propagate(scope.defProp("exports"));
        var moduleExports = scope.exports = module.defProp("exports");
        exports.propagate(moduleExports, 95);
        return scope;
    }

    function ResolveModule(server, name, _parent) {
        server.addFile(name, null, server._node.currentOrigin);
        return GetModule(server._node, name);
    }

    function BuildUIFileIDMap(obj, r) {
        r = r || {};
        if (obj.RootView) {
            r.$ = obj.RootView.type;
            BuildUIFileIDMap(obj.RootView, r);
        }
        if (obj.id) {
            r[obj.id] = obj.type;
        }
        if (obj.views) {
            var i = 0,
                l = obj.views.length;
            for (; i < l; i++) {
                BuildUIFileIDMap(obj.views[i], r);
            }
        }
        return r;
    }

    function GetScriptJSName(dir, fy, rs) {
        return [];
    }

    /** ******************************************************************************************************************** */
    var DEFINES;
    if (require)
        (function () {
            var fs = require("fs"),
                module_ = require("module"),
                path = require("path");
            RelativePath = path.relative;
            ResolveModule = function (server, name, parent) {
                var data = server._node;
                if (data.options.dontLoad == true || data.options.dontLoad && new RegExp(data.options.dontLoad).test(name) || data.options.load && !new RegExp(data.options.load).test(name))
                    return infer.ANull;
                if (data.modules[name])
                    return data.modules[name];
                var file = server.options.projectDir + "/source/default/script/" + name + ".js";
                var norm = NormPath(file);
                if (data.modules[norm])
                    return data.modules[norm];

                if (fs.existsSync(file) && /^(\.js)?$/.test(path.extname(file)))
                    server.addFile(RelativePath(server.options.projectDir, file), null, data.currentOrigin);
                return data.modules[norm] = new infer.AVal;
            };


            GetScriptJSName = function (dir, fy, rs) {
                rs = rs || [];
                fy = fy || "";
                var list = fs.readdirSync(dir);
                for (var i = 0; i < list.length; i++) {
                    var fx = list[i];
                    var file = dir + '/' + fx;
                    var stat = fs.statSync(file);
                    if (!stat) continue;
                    if (stat.isFile() && file.split(".").pop().toLowerCase() === "js") {
                        rs.push(fy + fx);
                    }
                    if (stat.isDirectory()) {
                        GetScriptJSName(file, fy + fx + "/", rs);
                    }
                }
                return rs;
            };

        })();
    /** ******************************************************************************************************************** */

    function NormPath(name) {
        return name.replace(/\\/g, "/");
    }

    function ResolveProjectPath(server, pth) {
        return ResolvePath(NormPath(server.options.projectDir || "") + "/", NormPath(pth));
    }

    function PreCondenseReach(state) {
        var mods = infer.cx().parent._node.modules;
        var node = state.roots["!node"] = new infer.Obj(null);
        for (var name in mods) {
            var mod = mods[name];
            var id = mod.origin || name;
            var prop = node.defProp(id.replace(/\./g, "`"));
            mod.propagate(prop);
            prop.origin = mod.origin;
        }
    }

    function PostLoadDef(data) {
        var cx = infer.cx(),
            mods = cx.definitions[data["!name"]]["!node"];
        var data = cx.parent._node;
        if (mods)
            for (var name in mods.props) {
                var origin = name.replace(/`/g, ".");
                var mod = GetModule(data, origin);
                mod.origin = origin;
                mods.props[name].propagate(mod);
            }
    }

    function FindTypeAt(file, pos, expr, type) {
        var isStringLiteral = expr.node.type === "Literal" && typeof expr.node.value === "string";
        var isRequireArg = !!expr.node.required;
        if (isStringLiteral && isRequireArg) {
            type = Object.create(type);
            var exportedType = expr.node.required.types[0];
            type.origin = exportedType.origin;
            type.originNode = exportedType.originNode;
        }
        return type;
    }

    function MaybeSet(obj, prop, val) {
        if (val != null)
            obj[prop] = val;
    }

    /** ***************Properties************* */
    function GetObjectProperties(proto) {
        var cx = infer.cx(),
            locals = cx.definitions.deviceone;
        var objectName = proto.name,
            index = objectName.indexOf("UI.");
        if (index == 0)
            objectName = objectName.substring("UI.".length, objectName.length);
        objectName = objectName.substring(0, objectName.indexOf('.'));
        return locals["!pp"].hasProp(objectName);
    }

    function GetPropertyType(widgetType, propertyName) {
        if (!(widgetType))
            return null;
        var proto = widgetType.proto,
            propertyType = null;
        while (proto) {
            var objectType = GetObjectProperties(proto);
            if (objectType && objectType.getType)
                propertyType = objectType.getType().hasProp(propertyName);
            if (propertyType)
                return propertyType;
            proto = proto.proto;
        }
        return null;
    }

    /** ***************Events************* */
    function GetEventProperties(proto) {
        var cx = infer.cx(),
            locals = cx.definitions.deviceone;
        var oname = proto.name;
        if (!oname.indexOf("UI.") || !oname.indexOf("SM.") || !oname.indexOf("MM.")) {
            oname = oname.substring("UI.".length, oname.length);
        }
        oname = oname.substring(0, oname.indexOf('.'));
        return locals["!ee"].hasProp(oname);
    }

    function Completion(file, query) {
        function getQuote(c) {
            return c === "'" || c === '"' ? c : null;
        }

        if (!query.end)
            return;

        var wordPos = tern.resolvePos(file, query.end);
        var word = null,
            completions = [];
        var wrapAsObjs = query.types || query.depths || query.docs || query.urls || query.origins;
        var cx = infer.cx(),
            overrideType = null;

        function gather(prop, obj, depth, addInfo) {
            if (obj == cx.protos.Object && !word)
                return;
            if (query.filter !== false && word && (query.caseInsensitive ? prop.toLowerCase() : prop).indexOf(word) !== 0)
                return;
            for (var i = 0; i < completions.length; ++i) {
                var c = completions[i];
                if ((wrapAsObjs ? c.name : c) == prop)
                    return;
            }
            var rec = wrapAsObjs ? {
                name: prop
            }
                : prop;
            completions.push(rec);

            if (obj && (query.types || query.docs || query.urls || query.origins)) {
                var val = obj.props[prop];
                infer.resetGuessing();
                var type = val.getType();
                rec.guess = infer.didGuess();
                if (query.types)
                    rec.type = overrideType != null ? overrideType : infer.toString(type);
                if (query.docs)
                    MaybeSet(rec, "doc", val.doc || type && type.doc);
                if (query.urls)
                    MaybeSet(rec, "url", val.url || type && type.url);
                if (query.origins)
                    MaybeSet(rec, "origin", val.origin || type && type.origin);
            }
            if (query.depths)
                rec.depth = depth;
            if (wrapAsObjs && addInfo)
                addInfo(rec);
        }

        var callExpr = infer.findExpressionAround(file.ast, null, wordPos, file.scope, "CallExpression");
        if (callExpr && callExpr.node.arguments && callExpr.node.arguments.length && callExpr.node.arguments.length > 0) {
            var nodeArg = callExpr.node.arguments[0];
            if (!(nodeArg.start <= wordPos && nodeArg.end >= wordPos))
                return;
            if (nodeArg._do_type) {
                var startQuote = getQuote(nodeArg.raw.charAt(0)),
                    endQuote = getQuote(nodeArg.raw.length > 1 ? nodeArg.raw.charAt(nodeArg.raw.length - 1) : null);
                var wordEnd = endQuote != null ? nodeArg.end - 1 : nodeArg.end,
                    wordStart = startQuote != null ? nodeArg.start + 1 : nodeArg.start,
                    word = nodeArg.value.slice(0,
                        nodeArg.value.length - (wordEnd - wordPos));
                if (query.caseInsensitive)
                    word = word.toLowerCase();

                switch (nodeArg._do_type.type) {
                    case "deviceone_pp":
                        var widgetType = nodeArg._do_type.proxy,
                            proto = widgetType.proto,
                            propertyType = null;
                        while (proto) {
                            var objType = GetObjectProperties(proto);
                            if (objType)
                                infer.forAllPropertiesOf(objType, gather);
                            proto = proto.proto;
                        }
                        break;

                    case "deviceone_ee":
                        var widgetType = nodeArg._do_type.proxy,
                            proto = widgetType.proto,
                            propertyType = null;
                        while (proto) {
                            var objType = GetEventProperties(proto);
                            if (objType)
                                infer.forAllPropertiesOf(objType, gather);
                            proto = proto.proto;
                        }
                        break;
                    case "deviceone_ui":
                        var server = cx.parent;
                        var _uimap = server._node.currentIDMap;
                        for (var k in _uimap) {
                            var _t = {};
                            _t.name = k;
                            _t.type = _uimap[k];
                            completions.push(_t);
                        }
                        break;
                    case "deviceone_sm":
                        var types = cx.definitions.deviceone["SM"];
                        overrideType = "SM";
                        infer.forAllPropertiesOf(types, gather);
                        break;
                    case "deviceone_mm":
                        var types = cx.definitions.deviceone["MM"];
                        overrideType = "MM";
                        infer.forAllPropertiesOf(types, gather);
                        break;
                    case "deviceone_rq":
                    	completions.push({ name : "deviceone", type:"module" });
                        var server = cx.parent;
                        var rs = GetScriptJSName(server.options.projectDir + "/source/default/script/");
                        var _t, _m;
                        for (var i = 0; i < rs.length; i++) {
                            _m = rs[i];
                            _t = {};
                            _t.name = _m.substring(0, _m.lastIndexOf(".js"));
                            _t.type = "module";
                            completions.push(_t);
                        }
                        break;
                }

                return {
                    start: tern.outputPos(query, file, wordStart),
                    end: tern.outputPos(query, file, wordEnd),
                    isProperty: false,
                    isStringAround: true,
                    startQuote: startQuote,
                    endQuote: endQuote,
                    completions: completions
                }
            }
        }
    }

    /** ******************************************************************************************************************** */

    infer.registerFunction("deviceone_ui", function (_self, args, argNodes) {
        if (!argNodes || !argNodes.length || argNodes[0].type != "Literal" || typeof argNodes[0].value != "string")
            return infer.ANull;
        var name = argNodes[0].value;
        var cx = infer.cx(),
            server = cx.parent;
        name = server._node.currentIDMap[name];
        var locals = cx.definitions.deviceone["UI"],
            dType = locals.hasProp(name);
        argNodes[0]._do_type = {
            "type": "deviceone_ui"
        };
        if (dType)
            return new infer.Obj(dType.getType().getProp("prototype").getType());
        return infer.ANull;
    });

    infer.registerFunction("deviceone_sm", function (_self, args, argNodes) {
        if (!argNodes || !argNodes.length || argNodes[0].type != "Literal" || typeof argNodes[0].value != "string")
            return infer.ANull;
        var name = argNodes[0].value;
        var cx = infer.cx(),
            server = cx.parent;
        var locals = cx.definitions.deviceone["SM"],
            dType = locals.hasProp(name);
        argNodes[0]._do_type = {
            "type": "deviceone_sm"
        };
        if (dType)
            return new infer.Obj(dType.getType().getProp("prototype").getType());
        return infer.ANull;
    });

    infer.registerFunction("deviceone_mm", function (_self, args, argNodes) {
        if (!argNodes || !argNodes.length || argNodes[0].type != "Literal" || typeof argNodes[0].value != "string")
            return infer.ANull;
        var name = argNodes[0].value;
        var cx = infer.cx(),
            server = cx.parent;
        var locals = cx.definitions.deviceone["MM"],
            dType = locals.hasProp(name);
        argNodes[0]._do_type = {
            "type": "deviceone_mm"
        };
        if (dType)
            return new infer.Obj(dType.getType().getProp("prototype").getType());
        return infer.ANull;
    });

    infer.registerFunction("deviceone_ee", function (_self, args, argNodes) {
        if (!argNodes || !argNodes.length || argNodes[0].type != "Literal" || typeof argNodes[0].value != "string")
            return infer.ANull;
        var proxy = _self.getType();
        argNodes[0]._do_type = {
            "type": "deviceone_ee",
            "proxy": proxy
        };
    });

    infer.registerFunction("deviceone_pp", function (_self, args, argNodes) {
        if (!argNodes || !argNodes.length || argNodes[0].type != "Literal" || typeof argNodes[0].value != "string")
            return infer.ANull;
        var widgetType = _self.getType(),
            propertyName = argNodes[0].value,
            propertyType = GetPropertyType(widgetType, propertyName);
        argNodes[0]._do_type = {
            "type": "deviceone_pp",
            "proxy": widgetType
        };
        if (propertyType)
            return propertyType.getType();
        return infer.ANull;
    });

    infer.registerFunction("deviceone_rq", function (_self, _args, argNodes) {
        if (!argNodes || !argNodes.length || argNodes[0].type != "Literal" || typeof argNodes[0].value != "string")
            return infer.ANull;
        var cx = infer.cx(),
            server = cx.parent,
            data = server._node,
            name = argNodes[0].value;

        argNodes[0]._do_type = {
            "type": "deviceone_rq",
            "proxy": _self.getType()
        };

        if (name == "deviceone") {
            return new infer.Obj(cx.definitions.deviceone["!$"]);
        }
        var result;
        if (data.options.modules && data.options.modules.hasOwnProperty(name)) {
            var scope = BuildWrappingScope(cx.topScope, name);
            infer.def.load(data.options.modules[name], scope);
            result = data.modules[name] = scope.exports;
        } else {
            var currentFile = data.currentFile || ResolveProjectPath(server, argNodes[0].sourceFile.name);
            var relative = /^\.{0,2}\//.test(name);
            if (relative) {
                if (!currentFile)
                    return argNodes[0].required || infer.ANull;
                name = ResolvePath(currentFile, name);
            }
            result = ResolveModule(server, name, currentFile);
        }
        return argNodes[0].required = result;
    });
    
    infer.registerFunction("deviceone_cs", function(_self, args, argNodes) {
        var cx = infer.cx();
        var Cs = new infer.Obj(null);
        Cs.defProp("fz");
        return Cs;
    });

    tern.registerPlugin("deviceone", function (server, options) {

        server._node = {
            modules: Object.create(null),
            options: options || {},
            currentFile: null,
            currentRequires: [],
            currentOrigin: null,
            server: server
        };

        server.on("beforeLoad", function (file) {
            var fs = require("fs");
            if (StringEndWith(file.name, ".ui.js")) {
                var pathui = (server.options.projectDir + "/" + file.name).replace(".ui.js", ".ui");
                if (fs.existsSync(pathui)) {
                    this._node.currentIDMap = BuildUIFileIDMap(JSON.parse(fs.readFileSync(pathui)));
                }
            }
            this._node.currentFile = ResolveProjectPath(server, file.name);
            this._node.currentOrigin = file.name;
            this._node.currentRequires = [];
            file.scope = BuildWrappingScope(file.scope, this._node.currentOrigin, file.ast);
        });

        server.on("afterLoad", function (file) {
            var mod = GetModule(this._node, this._node.currentFile);
            mod.origin = this._node.currentOrigin;
            file.scope.exports.propagate(mod);
            this._node.currentFile = null;
            this._node.currentOrigin = null;
        });

        server.on("reset", function () {
            this._node.modules = Object.create(null);
        });

        return {
            defs: DEFINES,
            passes: {
                completion: Completion,
                preCondenseReach: PreCondenseReach,
                postLoadDef: PostLoadDef,
                typeAt: FindTypeAt
            }

        };
    });
/**}); **/ 
DEFINES={"!define":{"!pp":{"do_SegmentView":{"index":{"!type":"number"},"templates":{"!type":"string"}},"do_Http":{"body":{"!type":"string"},"method":{"!type":"string"},"contentType":{"!type":"string"},"url":{"!type":"string"},"timeout":{"!type":"number"}},"do_SlideView":{"index":{"!type":"number"},"templates":{"!type":"Node"},"looping":{"!type":"bool"},"isAllCache":{"!type":"bool"}},"do_VerticalSlideView":{"index":{"!type":"number"},"templates":{"!type":"Node"}},"do_MarqueeLabel":{"text":{"!type":"string"},"fontColor":{"!type":"string"},"textFlag":{"!type":"string"},"direction":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"}},"do_IndexListView":{"templates":{"!type":"string"},"selectedColor":{"!type":"string"},"indexBarColors":{"!type":"string"}},"do_ProgressBar1":{"pointColors":{"!type":"string"},"changeImage":{"!type":"string"},"style":{"!type":"string"},"defaultImage":{"!type":"string"},"pointNum":{"!type":"number"}},"do_SlideListView":{"headerView":{"!type":"string"},"isShowbar":{"!type":"bool"},"templates":{"!type":"string"},"selectedColor":{"!type":"string"},"isFooterVisible":{"!type":"bool"},"isHeaderVisible":{"!type":"bool"},"footerView":{"!type":"string"}},"do_ListView":{"headerView":{"!type":"string"},"isShowbar":{"!type":"bool"},"templates":{"!type":"string"},"selectedColor":{"!type":"string"},"isFooterVisible":{"!type":"bool"},"isHeaderVisible":{"!type":"bool"},"isDivisionLineVisible":{"!type":"bool"},"footerView":{"!type":"string"}},"do_ProgressBar":{"progress":{"!type":"number"},"style":{"!type":"string"}},"do_ExpandableListView":{"isShowbar":{"!type":"bool"},"selectedColor":{"!type":"string"},"groupTemplate":{"!type":"string"},"childTemplate":{"!type":"string"}},"do_CheckBox":{"enabled":{"!type":"bool"},"text":{"!type":"string"},"fontColor":{"!type":"string"},"textFlag":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"},"checked":{"!type":"bool"}},"do_FrameAnimationView":{},"do_SwitchView":{"colors":{"!type":"string"},"shape":{"!type":"string"},"checked":{"!type":"bool"}},"do_TextBox":{"enabled":{"!type":"bool"},"text":{"!type":"string"},"fontColor":{"!type":"string"},"maxLength":{"!type":"number"},"textFlag":{"!type":"string"},"hint":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"}},"do_ScrollView":{"headerView":{"!type":"string"},"isShowbar":{"!type":"bool"},"direction":{"!type":"string"},"isHeaderVisible":{"!type":"bool"}},"do_RichLabel":{"text":{"!type":"string"},"maxLines":{"!type":"number"},"maxWidth":{"!type":"number"},"maxHeight":{"!type":"number"}},"do_LinearLayout":{"enabled":{"!type":"bool"},"bgImageFillType":{"!type":"string"},"direction":{"!type":"string"},"bgImage":{"!type":"string"},"padding":{"!type":"string"}},"do_TextField":{"enabled":{"!type":"bool"},"text":{"!type":"string"},"fontColor":{"!type":"string"},"maxLength":{"!type":"number"},"textFlag":{"!type":"string"},"inputType":{"!type":"string"},"clearAll":{"!type":"bool"},"hint":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"},"password":{"!type":"bool"},"enterText":{"!type":"string"}},"do_FragmentView":{"templates":{"!type":"Node"}},"do_BarcodeView":{"scanArea":{"!type":"string"}},"do_HashData":{},"do_WebView":{"headerView":{"!type":"string"},"zoom":{"!type":"bool"},"url":{"!type":"string"},"isHeaderVisible":{"!type":"bool"},"isShowLoadingProgress":{"!type":"bool"}},"do_MultiSelectComboBox":{"text":{"!type":"string"},"fontColor":{"!type":"string"},"items":{"!type":"string"},"textFlag":{"!type":"string"},"textAlign":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"},"indexs":{"!type":"string"}},"do_Animator":{},"do_Button":{"enabled":{"!type":"bool"},"text":{"!type":"string"},"fontColor":{"!type":"string"},"textFlag":{"!type":"string"},"radius":{"!type":"number"},"fontStyle":{"!type":"string"},"bgImage":{"!type":"string"},"fontSize":{"!type":"number"}},"do_Socket":{},"do_ListData":{},"do_ImageView":{"scale":{"!type":"string"},"enabled":{"!type":"bool"},"source":{"!type":"string"},"cacheType":{"!type":"string"},"defaultImage":{"!type":"string"},"radius":{"!type":"number"}},"do_GridView":{"isShowbar":{"!type":"bool"},"templates":{"!type":"Node"},"vSpacing":{"!type":"number"},"selectedColor":{"!type":"string"},"numColumns":{"!type":"number"},"hSpacing":{"!type":"number"}},"do_Label":{"text":{"!type":"string"},"fontColor":{"!type":"string"},"textFlag":{"!type":"string"},"maxLines":{"!type":"number"},"maxWidth":{"!type":"number"},"maxHeight":{"!type":"number"},"textAlign":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"}},"do_SQLite":{},"do_ViewShower":{},"do_ProgressBar2":{"progressColor":{"!type":"string"},"progressBgColor":{"!type":"string"},"progress":{"!type":"number"},"text":{"!type":"string"},"fontColor":{"!type":"string"},"progressWidth":{"!type":"string"},"style":{"!type":"string"},"fontSize":{"!type":"number"}},"M0011_FelixMenuButton":{"button_menu_name":{"!type":"string"},"button_name":{"!type":"string"}},"do_VideoView":{"path":{"!type":"string"}},"do_Timer":{"interval":{"!type":"number"},"delay":{"!type":"number"}},"do_BaiduMapView":{"zoomLevel":{"!type":"number"}},"do_ComboBox":{"index":{"!type":"number"},"fontColor":{"!type":"string"},"items":{"!type":"string"},"textFlag":{"!type":"string"},"textAlign":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"}},"do_Animation":{"fillAfter":{"!type":"bool"}},"do_ALayout":{"enabled":{"!type":"bool"},"bgImageFillType":{"!type":"string"},"isStretch":{"!type":"bool"},"bgImage":{"!type":"string"},"layoutAlign":{"!type":"string"}}},"Event":{},"UI":{"do_SegmentView":{"!url":"","!type":"fn()","prototype":{"refreshItems":{"!type":"fn()"},"index":{"!type":"number"},"templates":{"!type":"string"},"bindItems":{"!type":"fn(data: Node)"},"!proto":"!UI.prototype"}},"do_SlideView":{"!url":"","!type":"fn()","prototype":{"refreshItems":{"!type":"fn()"},"index":{"!type":"number"},"templates":{"!type":"Node"},"looping":{"!type":"bool"},"bindItems":{"!type":"fn(data: Node)"},"!proto":"!UI.prototype","isAllCache":{"!type":"bool"}}},"do_VerticalSlideView":{"!url":"","!type":"fn()","prototype":{"refreshItems":{"!type":"fn()"},"index":{"!type":"number"},"templates":{"!type":"Node"},"bindItems":{"!type":"fn(data: Node)"},"!proto":"!UI.prototype"}},"do_MarqueeLabel":{"!url":"","!type":"fn()","prototype":{"text":{"!type":"string"},"fontColor":{"!type":"string"},"textFlag":{"!type":"string"},"direction":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"},"!proto":"!UI.prototype"}},"do_IndexListView":{"!url":"","!type":"fn()","prototype":{"refreshItems":{"!type":"fn()"},"templates":{"!type":"string"},"selectedColor":{"!type":"string"},"indexBarColors":{"!type":"string"},"bindItems":{"!type":"fn(data: Node, indexs: Node)"},"!proto":"!UI.prototype"}},"do_ProgressBar1":{"!url":"","!type":"fn()","prototype":{"pointColors":{"!type":"string"},"changeImage":{"!type":"string"},"style":{"!type":"string"},"defaultImage":{"!type":"string"},"pointNum":{"!type":"number"},"!proto":"!UI.prototype"}},"do_SlideListView":{"!url":"","!type":"fn()","prototype":{"headerView":{"!type":"string"},"refreshItems":{"!type":"fn()"},"isShowbar":{"!type":"bool"},"templates":{"!type":"string"},"selectedColor":{"!type":"string"},"rebound":{"!type":"fn()"},"isFooterVisible":{"!type":"bool"},"bindItems":{"!type":"fn(data: Node)"},"isHeaderVisible":{"!type":"bool"},"footerView":{"!type":"string"},"!proto":"!UI.prototype"}},"do_ListView":{"!url":"","!type":"fn()","prototype":{"headerView":{"!type":"string"},"scrollToPosition":{"!type":"fn(position: number)"},"refreshItems":{"!type":"fn()"},"isShowbar":{"!type":"bool"},"templates":{"!type":"string"},"selectedColor":{"!type":"string"},"rebound":{"!type":"fn()"},"isFooterVisible":{"!type":"bool"},"bindItems":{"!type":"fn(data: Node)"},"isHeaderVisible":{"!type":"bool"},"isDivisionLineVisible":{"!type":"bool"},"footerView":{"!type":"string"},"!proto":"!UI.prototype"}},"do_ProgressBar":{"!url":"","!type":"fn()","prototype":{"progress":{"!type":"number"},"style":{"!type":"string"},"!proto":"!UI.prototype"}},"do_ExpandableListView":{"!url":"","!type":"fn()","prototype":{"refreshItems":{"!type":"fn()"},"collapseGroup":{"!type":"fn(indexs: Node)"},"isShowbar":{"!type":"bool"},"selectedColor":{"!type":"string"},"bindItems":{"!type":"fn(groupData: Node, childData: Node)"},"groupTemplate":{"!type":"string"},"childTemplate":{"!type":"string"},"expandGroup":{"!type":"fn(indexs: Node)"},"!proto":"!UI.prototype"}},"do_CheckBox":{"!url":"","!type":"fn()","prototype":{"enabled":{"!type":"bool"},"text":{"!type":"string"},"fontColor":{"!type":"string"},"textFlag":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"},"checked":{"!type":"bool"},"!proto":"!UI.prototype"}},"do_FrameAnimationView":{"!url":"","!type":"fn()","prototype":{"stop":{"!type":"fn()"},"startImages":{"!type":"fn(data: Node, repeat: number)"},"startGif":{"!type":"fn(data: string, repeat: number)"},"!proto":"!UI.prototype"}},"do_SwitchView":{"!url":"","!type":"fn()","prototype":{"colors":{"!type":"string"},"shape":{"!type":"string"},"checked":{"!type":"bool"},"!proto":"!UI.prototype"}},"do_TextBox":{"!url":"","!type":"fn()","prototype":{"setFocus":{"!type":"fn(value: bool)"},"enabled":{"!type":"bool"},"text":{"!type":"string"},"fontColor":{"!type":"string"},"maxLength":{"!type":"number"},"textFlag":{"!type":"string"},"hint":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"},"!proto":"!UI.prototype"}},"do_ScrollView":{"!url":"","!type":"fn()","prototype":{"headerView":{"!type":"string"},"toBegin":{"!type":"fn()"},"isShowbar":{"!type":"bool"},"direction":{"!type":"string"},"toEnd":{"!type":"fn()"},"rebound":{"!type":"fn()"},"isHeaderVisible":{"!type":"bool"},"!proto":"!UI.prototype"}},"do_RichLabel":{"!url":"","!type":"fn()","prototype":{"text":{"!type":"string"},"maxLines":{"!type":"number"},"maxWidth":{"!type":"number"},"maxHeight":{"!type":"number"},"!proto":"!UI.prototype"}},"do_LinearLayout":{"!url":"","!type":"fn()","prototype":{"enabled":{"!type":"bool"},"bgImageFillType":{"!type":"string"},"direction":{"!type":"string"},"bgImage":{"!type":"string"},"padding":{"!type":"string"},"add":{"!type":"fn(id: string, path: string, target: string) -> string"},"!proto":"!UI.prototype"}},"do_TextField":{"!url":"","!type":"fn()","prototype":{"setFocus":{"!type":"fn(value: bool)"},"enabled":{"!type":"bool"},"text":{"!type":"string"},"fontColor":{"!type":"string"},"maxLength":{"!type":"number"},"textFlag":{"!type":"string"},"inputType":{"!type":"string"},"clearAll":{"!type":"bool"},"hint":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"},"password":{"!type":"bool"},"enterText":{"!type":"string"},"!proto":"!UI.prototype"}},"do_FragmentView":{"!url":"","!type":"fn()","prototype":{"refreshItems":{"!type":"fn()"},"templates":{"!type":"Node"},"showLeft":{"!type":"fn()"},"showRight":{"!type":"fn()"},"bindItems":{"!type":"fn(data: Node)"},"!proto":"!UI.prototype"}},"do_BarcodeView":{"!url":"","!type":"fn()","prototype":{"scanArea":{"!type":"string"},"start":{"!type":"fn(f: fn(data: Node, e: ?)) -> !this","!effects":["call !0 this=!this"]},"!proto":"!UI.prototype"}},"do_WebView":{"!url":"","!type":"fn()","prototype":{"headerView":{"!type":"string"},"stop":{"!type":"fn()"},"zoom":{"!type":"bool"},"back":{"!type":"fn()"},"loadString":{"!type":"fn(text: string, f: fn(data: , e: ?)) -> !this","!effects":["call !1 this=!this"]},"isHeaderVisible":{"!type":"bool"},"url":{"!type":"string"},"forward":{"!type":"fn()"},"canBack":{"!type":"fn() -> bool"},"rebound":{"!type":"fn()"},"reload":{"!type":"fn()"},"canForward":{"!type":"fn() -> bool"},"!proto":"!UI.prototype","isShowLoadingProgress":{"!type":"bool"}}},"do_MultiSelectComboBox":{"!url":"","!type":"fn()","prototype":{"text":{"!type":"string"},"fontColor":{"!type":"string"},"items":{"!type":"string"},"textFlag":{"!type":"string"},"textAlign":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"},"!proto":"!UI.prototype","indexs":{"!type":"string"}}},"do_Button":{"!url":"","!type":"fn()","prototype":{"enabled":{"!type":"bool"},"text":{"!type":"string"},"fontColor":{"!type":"string"},"textFlag":{"!type":"string"},"radius":{"!type":"number"},"fontStyle":{"!type":"string"},"bgImage":{"!type":"string"},"fontSize":{"!type":"number"},"!proto":"!UI.prototype"}},"do_ImageView":{"!url":"","!type":"fn()","prototype":{"scale":{"!type":"string"},"enabled":{"!type":"bool"},"source":{"!type":"string"},"cacheType":{"!type":"string"},"defaultImage":{"!type":"string"},"radius":{"!type":"number"},"!proto":"!UI.prototype"}},"do_Label":{"!url":"","!type":"fn()","prototype":{"text":{"!type":"string"},"fontColor":{"!type":"string"},"textFlag":{"!type":"string"},"maxLines":{"!type":"number"},"maxWidth":{"!type":"number"},"maxHeight":{"!type":"number"},"textAlign":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"},"!proto":"!UI.prototype"}},"do_GridView":{"!url":"","!type":"fn()","prototype":{"refreshItems":{"!type":"fn()"},"isShowbar":{"!type":"bool"},"templates":{"!type":"Node"},"vSpacing":{"!type":"number"},"selectedColor":{"!type":"string"},"numColumns":{"!type":"number"},"hSpacing":{"!type":"number"},"bindItems":{"!type":"fn(data: Node)"},"!proto":"!UI.prototype"}},"do_ViewShower":{"!url":"","!type":"fn()","prototype":{"showView":{"!type":"fn(id: string, animationType: string, animationTime: number)"},"removeView":{"!type":"fn(id: string)"},"addViews":{"!type":"fn(data: Node)"},"!proto":"!UI.prototype"}},"do_ProgressBar2":{"!url":"","!type":"fn()","prototype":{"progressColor":{"!type":"string"},"progressBgColor":{"!type":"string"},"progress":{"!type":"number"},"text":{"!type":"string"},"fontColor":{"!type":"string"},"progressWidth":{"!type":"string"},"style":{"!type":"string"},"fontSize":{"!type":"number"},"!proto":"!UI.prototype"}},"M0011_FelixMenuButton":{"!url":"","!type":"fn()","prototype":{"button_menu_name":{"!type":"string"},"button_name":{"!type":"string"},"!proto":"!UI.prototype"}},"do_VideoView":{"!url":"","!type":"fn()","prototype":{"pause":{"!type":"fn() -> number"},"stop":{"!type":"fn()"},"resume":{"!type":"fn()"},"path":{"!type":"string"},"play":{"!type":"fn(point: number)"},"!proto":"!UI.prototype"}},"do_BaiduMapView":{"!url":"","!type":"fn()","prototype":{"addMarkers":{"!type":"fn(data: Node) -> bool"},"zoomLevel":{"!type":"number"},"removeMarker":{"!type":"fn(ids: Node)"},"!proto":"!UI.prototype","setCenter":{"!type":"fn(latitude: string, longitude: string) -> bool"},"removeAll":{"!type":"fn()"}}},"do_ComboBox":{"!url":"","!type":"fn()","prototype":{"index":{"!type":"number"},"fontColor":{"!type":"string"},"items":{"!type":"string"},"textFlag":{"!type":"string"},"textAlign":{"!type":"string"},"fontStyle":{"!type":"string"},"fontSize":{"!type":"number"},"!proto":"!UI.prototype"}},"do_ALayout":{"!url":"","!type":"fn()","prototype":{"enabled":{"!type":"bool"},"bgImageFillType":{"!type":"string"},"isStretch":{"!type":"bool"},"bgImage":{"!type":"string"},"add":{"!type":"fn(id: string, path: string, x: string, y: string) -> string"},"layoutAlign":{"!type":"string"},"!proto":"!UI.prototype"}}},"!E":{"prototype":{"getType":{"!url":"","!doc":"","!type":"fn() -> string"},"off":{"!url":"","!doc":"","!type":"fn(name: string) -> !this","!effects":["custom deviceone_ee"]},"on":{"!url":"","!doc":"","!type":"fn(name: string, data: Node, delay: number, f: fn(data: Node, e: Node)) -> !this","!effects":["custom deviceone_ee","call !3 this=!this"]},"fire":{"!url":"","!doc":"","!type":"fn(name: string, data?: Node) -> !this","!effects":["custom deviceone_ee"]},"getAddress":{"!url":"","!doc":"","!type":"fn() -> string"}}},"MM":{"do_Http":{"!url":"","!type":"fn()","prototype":{"body":{"!type":"string"},"setRequestHeader":{"!type":"fn(key: string, value: string)"},"getResponseHeader":{"!type":"fn(key: string) -> string"},"request":{"!type":"fn()"},"method":{"!type":"string"},"download":{"!type":"fn(path: string)"},"contentType":{"!type":"string"},"url":{"!type":"string"},"timeout":{"!type":"number"},"upload":{"!type":"fn(path: string, name: string)"},"!proto":"!MM.prototype"}},"do_ListData":{"!url":"","!type":"fn()","prototype":{"updateOne":{"!type":"fn(index: number, data: Node)"},"getRange":{"!type":"fn(fromIndex: number, toIndex: number)"},"getData":{"!type":"fn(indexs: Node)"},"addOne":{"!type":"fn(data: string, index: number)"},"removeData":{"!type":"fn(indexs: Node)"},"getOne":{"!type":"fn(index: number) -> string"},"removeRange":{"!type":"fn(fromIndex: number, toIndex: number)"},"addData":{"!type":"fn(data: Node, index: Node)"},"!proto":"!MM.prototype","removeAll":{"!type":"fn()"},"getCount":{"!type":"fn() -> number"}}},"do_HashData":{"!url":"","!type":"fn()","prototype":{"getData":{"!type":"fn(keys: Node) -> Node"},"getAll":{"!type":"fn() -> Node"},"addOne":{"!type":"fn(key: string, value: string)"},"removeOne":{"!type":"fn(key: string)"},"removeData":{"!type":"fn(keys: Node)"},"getOne":{"!type":"fn(key: string) -> string"},"addData":{"!type":"fn(data: Node)"},"!proto":"!MM.prototype","removeAll":{"!type":"fn()"},"getCount":{"!type":"fn() -> number"}}},"do_Animator":{"!url":"","!type":"fn()","prototype":{"append":{"!type":"fn(duration: number, props: Node, curve: string)"},"!proto":"!MM.prototype"}},"do_SQLite":{"!url":"","!type":"fn()","prototype":{"open":{"!type":"fn(path: string) -> bool"},"execute":{"!type":"fn(sql: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !1 this=!this"]},"query":{"!type":"fn(sql: string, f: fn(data: Node, e: ?)) -> !this","!effects":["call !1 this=!this"]},"!proto":"!MM.prototype","executeSync":{"!type":"fn(sql: string) -> bool"},"close":{"!type":"fn() -> bool"}}},"do_Socket":{"!url":"","!type":"fn()","prototype":{"send":{"!type":"fn(type: string, content: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !2 this=!this"]},"connect":{"!type":"fn(ip: string, port: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !2 this=!this"]},"!proto":"!MM.prototype","close":{"!type":"fn() -> bool"}}},"do_Timer":{"!url":"","!type":"fn()","prototype":{"stop":{"!type":"fn()"},"interval":{"!type":"number"},"start":{"!type":"fn()"},"isStart":{"!type":"fn() -> bool"},"delay":{"!type":"number"},"!proto":"!MM.prototype"}},"do_Animation":{"!url":"","!type":"fn()","prototype":{"scale":{"!type":"fn(data: Node, id: string)"},"transfer":{"!type":"fn(data: Node, id: string)"},"rotate":{"!type":"fn(data: Node, id: string)"},"fillAfter":{"!type":"bool"},"alpha":{"!type":"fn(data: Node, id: string)"},"!proto":"!MM.prototype"}}},"!$":"deviceone","SM":{"do_App":{"!url":"","!type":"fn()","prototype":{"update":{"!type":"fn(source: Node, target: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !2 this=!this"]},"openPage":{"!type":"fn(source: string, data: string, animationType: string, keyboardMode: string, scriptType: string, statusBarState: string, statusBarFgColor: string, id: string, f: fn(data: , e: ?)) -> !this","!effects":["call !8 this=!this"]},"closePage":{"!type":"fn(data: string, animationType: string, layer: number, f: fn(data: , e: ?)) -> !this","!effects":["call !3 this=!this"]},"getAppID":{"!type":"fn() -> string"},"!proto":"!SM.prototype","closePageToID":{"!type":"fn(data: string, animationType: string, id: string, f: fn(data: , e: ?)) -> !this","!effects":["call !3 this=!this"]}}},"do_SinaWeiBo":{"!url":"","!type":"fn()","prototype":{"share":{"!type":"fn(appId: string, type: number, title: string, image: string, url: string, summary: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !6 this=!this"]},"logout":{"!type":"fn(f: fn(data: bool, e: ?)) -> !this","!effects":["call !0 this=!this"]},"getUserInfo":{"!type":"fn(uid: string, accessToken: string, refreshToken: string, expires: string, f: fn(data: string, e: ?)) -> !this","!effects":["call !4 this=!this"]},"login":{"!type":"fn(appId: string, f: fn(data: string, e: ?)) -> !this","!effects":["call !1 this=!this"]},"!proto":"!SM.prototype"}},"do_TencentWX":{"!url":"","!type":"fn()","prototype":{"share":{"!type":"fn(appId: string, scene: number, type: number, title: string, content: string, url: string, image: string, audio: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !8 this=!this"]},"pay":{"!type":"fn(appId: string, partnerId: string, prepayId: string, package: string, nonceStr: string, timeStamp: string, sign: string, f: fn(data: number, e: ?)) -> !this","!effects":["call !7 this=!this"]},"login":{"!type":"fn(appId: string, f: fn(data: Node, e: ?)) -> !this","!effects":["call !1 this=!this"]},"!proto":"!SM.prototype"}},"do_Global":{"!url":"","!type":"fn()","prototype":{"install":{"!type":"fn(src: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !1 this=!this"]},"getFromPasteboard":{"!type":"fn() -> string"},"getVersion":{"!type":"fn() -> Node"},"getTime":{"!type":"fn(format: string) -> string"},"getMemory":{"!type":"fn(key: string) -> string"},"getWakeupID":{"!type":"fn() -> string"},"exit":{"!type":"fn()"},"!proto":"!SM.prototype","setToPasteboard":{"!type":"fn(data: string) -> bool"},"setMemory":{"!type":"fn(key: string, value: string)"}}},"do_BaiduLocation":{"!url":"","!type":"fn()","prototype":{"stop":{"!type":"fn()"},"start":{"!type":"fn(model: string, isLoop: bool)"},"!proto":"!SM.prototype"}},"do_Algorithm":{"!url":"","!type":"fn()","prototype":{"base64":{"!type":"fn(type: string, sourceType: string, source: string, f: fn(data: string, e: ?)) -> !this","!effects":["call !3 this=!this"]},"md5Sync":{"!type":"fn(value: string) -> string"},"md5":{"!type":"fn(type: string, value: string, f: fn(data: string, e: ?)) -> !this","!effects":["call !2 this=!this"]},"base64Sync":{"!type":"fn(type: string, source: string) -> string"},"sha1":{"!type":"fn(type: string, value: string, f: fn(data: string, e: ?)) -> !this","!effects":["call !2 this=!this"]},"des3Sync":{"!type":"fn(key: string, type: string, source: string) -> string"},"des3":{"!type":"fn(key: string, type: string, source: string, f: fn(data: string, e: ?)) -> !this","!effects":["call !3 this=!this"]},"!proto":"!SM.prototype","sha1Sync":{"!type":"fn(type: string, value: string) -> string"}}},"do_BaiduPush":{"!url":"","!type":"fn()","prototype":{"stopWork":{"!type":"fn()"},"startWork":{"!type":"fn()"},"!proto":"!SM.prototype","setIconBadgeNumber":{"!type":"fn(quantity: number)"},"getIconBadgeNumber":{"!type":"fn() -> number"}}},"do_Audio":{"!url":"","!type":"fn()","prototype":{"pause":{"!type":"fn() -> number"},"stop":{"!type":"fn()"},"resume":{"!type":"fn()"},"stopRecord":{"!type":"fn() -> string"},"startRecord":{"!type":"fn(path: string, type: string, quality: string, limit: number) -> bool"},"play":{"!type":"fn(path: string, point: number)"},"!proto":"!SM.prototype"}},"do_DateTimePicker":{"!url":"","!type":"fn()","prototype":{"show":{"!type":"fn(type: number, data: string, maxDate: string, minDate: string, title: string, buttons: Node, f: fn(data: Node, e: ?)) -> !this","!effects":["call !6 this=!this"]},"!proto":"!SM.prototype"}},"do_Alipay":{"!url":"","!type":"fn()","prototype":{"pay":{"!type":"fn(rsaPrivate: string, rsaPublic: string, partner: string, notifyUrl: string, tradeNo: string, subject: string, sellerId: string, totalFee: string, body: string, timeOut: string, f: fn(data: Node, e: ?)) -> !this","!effects":["call !10 this=!this"]},"!proto":"!SM.prototype"}},"do_Camera":{"!url":"","!type":"fn()","prototype":{"capture":{"!type":"fn(width: string, height: string, quality: number, iscut: bool, f: fn(data: string, e: ?)) -> !this","!effects":["call !4 this=!this"]},"!proto":"!SM.prototype"}},"do_Device":{"!url":"","!type":"fn()","prototype":{"getLocale":{"!type":"fn() -> Node"},"flash":{"!type":"fn(status: string)"},"screenShot":{"!type":"fn(f: fn(data: string, e: ?)) -> !this","!effects":["call !0 this=!this"]},"vibrate":{"!type":"fn(duration: number)"},"getInfo":{"!type":"fn() -> Node"},"getAllAppInfo":{"!type":"fn() -> Node"},"beep":{"!type":"fn()"},"!proto":"!SM.prototype"}},"do_AppleIAP":{"!url":"","!type":"fn()","prototype":{"restoreProduct":{"!type":"fn()"},"purchase":{"!type":"fn(productID: string, verifyURL: string, f: fn(data: string, e: ?)) -> !this","!effects":["call !2 this=!this"]},"!proto":"!SM.prototype"}},"do_UMengAnalytics":{"!url":"","!type":"fn()","prototype":{"endPageLog":{"!type":"fn(pageName: string)"},"setEncryptLog":{"!type":"fn(value: bool)"},"setCrashReportEnabled":{"!type":"fn(value: bool)"},"eventValueLog":{"!type":"fn(id: string, data: Node, counter: number)"},"eventLog":{"!type":"fn(id: string, data: Node)"},"setBackgroundTask":{"!type":"fn(value: bool)"},"reportPolicy":{"!type":"fn(type: string)"},"readConfig":{"!type":"fn(configID: string) -> string"},"!proto":"!SM.prototype","beginPageLog":{"!type":"fn(pageName: string)"}}},"do_Page":{"!url":"","!type":"fn()","prototype":{"remove":{"!type":"fn(id: )"},"getData":{"!type":"fn() -> string"},"hideKeyboard":{"!type":"fn()"},"supportPanClosePage":{"!type":"fn(data: string)"},"!proto":"!SM.prototype"}},"do_Storage":{"!url":"","!type":"fn()","prototype":{"dirExist":{"!type":"fn(path: string) -> bool"},"fileExist":{"!type":"fn(path: string) -> bool"},"zip":{"!type":"fn(source: string, target: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !2 this=!this"]},"zipFiles":{"!type":"fn(source: Node, target: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !2 this=!this"]},"writeFile":{"!type":"fn(path: string, data: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !2 this=!this"]},"unzip":{"!type":"fn(source: string, target: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !2 this=!this"]},"getDirs":{"!type":"fn(path: string, f: fn(data: Node, e: ?)) -> !this","!effects":["call !1 this=!this"]},"getFiles":{"!type":"fn(path: string, f: fn(data: Node, e: ?)) -> !this","!effects":["call !1 this=!this"]},"deleteDir":{"!type":"fn(path: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !1 this=!this"]},"readFile":{"!type":"fn(path: string, f: fn(data: string, e: ?)) -> !this","!effects":["call !1 this=!this"]},"!proto":"!SM.prototype","deleteFile":{"!type":"fn(path: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !1 this=!this"]},"copy":{"!type":"fn(source: Node, target: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !2 this=!this"]}}},"do_Network":{"!url":"","!type":"fn()","prototype":{"getStatus":{"!type":"fn() -> string"},"getMACAddress":{"!type":"fn() -> string"},"getIP":{"!type":"fn() -> string"},"!proto":"!SM.prototype"}},"do_AssistiveTouch":{"!url":"","!type":"fn()","prototype":{"showView":{"!type":"fn(location: string, image: string, isMove: bool)"},"hideView":{"!type":"fn()"},"!proto":"!SM.prototype"}},"do_SangforVPN":{"!url":"","!type":"fn()","prototype":{"logout":{"!type":"fn(f: fn(data: Node, e: ?)) -> !this","!effects":["call !0 this=!this"]},"login":{"!type":"fn(host: string, username: string, password: string, port: number, f: fn(data: Node, e: ?)) -> !this","!effects":["call !4 this=!this"]},"!proto":"!SM.prototype"}},"do_External":{"!url":"","!type":"fn()","prototype":{"openFile":{"!type":"fn(path: string) -> bool"},"openContact":{"!type":"fn()"},"openMail":{"!type":"fn(to: string, subject: string, body: string)"},"openDial":{"!type":"fn(number: string)"},"openSMS":{"!type":"fn(number: string, body: string)"},"openURL":{"!type":"fn(url: string)"},"openApp":{"!type":"fn(wakeupid: string, data: Node) -> bool"},"!proto":"!SM.prototype","installApp":{"!type":"fn(path: string)"}}},"do_TencentQQ":{"!url":"","!type":"fn()","prototype":{"logout":{"!type":"fn(f: fn(data: bool, e: ?)) -> !this","!effects":["call !0 this=!this"]},"shareToQQ":{"!type":"fn(appId: string, type: number, title: string, url: string, image: string, summary: string, audio: string, appName: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !8 this=!this"]},"getUserInfo":{"!type":"fn(token: string, expires: string, openId: string, f: fn(data: string, e: ?)) -> !this","!effects":["call !3 this=!this"]},"login":{"!type":"fn(appId: string, f: fn(data: string, e: ?)) -> !this","!effects":["call !1 this=!this"]},"shareToQzone":{"!type":"fn(appId: string, type: number, title: string, url: string, image: string, summary: string, f: fn(data: bool, e: ?)) -> !this","!effects":["call !6 this=!this"]},"!proto":"!SM.prototype"}},"do_DataCache":{"!url":"","!type":"fn()","prototype":{"saveData":{"!type":"fn(key: string, value: string) -> bool"},"loadData":{"!type":"fn(key: string) -> string"},"!proto":"!SM.prototype"}},"do_iFlyVoice":{"!url":"","!type":"fn()","prototype":{"pause":{"!type":"fn()"},"open":{"!type":"fn(f: fn(data: Node, e: ?)) -> !this","!effects":["call !0 this=!this"]},"stop":{"!type":"fn()"},"resume":{"!type":"fn()"},"speak":{"!type":"fn(text: string, role: string)"},"!proto":"!SM.prototype"}},"M0011_share":{"!url":"","!type":"fn()","prototype":{"share":{"!type":"fn(title: string, content: string)"},"!proto":"!SM.prototype"}},"do_Notification":{"!url":"","!type":"fn()","prototype":{"alert":{"!type":"fn(text: string, title: string, f: fn(data: , e: ?)) -> !this","!effects":["call !2 this=!this"]},"toast":{"!type":"fn(text: string)"},"confirm":{"!type":"fn(text: string, title: string, button1text: string, button2text: string, f: fn(data: number, e: ?)) -> !this","!effects":["call !4 this=!this"]},"!proto":"!SM.prototype"}},"do_ImageBrowser":{"!url":"","!type":"fn()","prototype":{"show":{"!type":"fn(data: Node, index: number)"},"!proto":"!SM.prototype"}},"do_Album":{"!url":"","!type":"fn()","prototype":{"save":{"!type":"fn(path: string, name: string, width: number, height: number, quality: number, f: fn(data: bool, e: ?)) -> !this","!effects":["call !5 this=!this"]},"select":{"!type":"fn(maxCount: number, width: number, height: number, quality: number, f: fn(data: Node, e: ?)) -> !this","!effects":["call !4 this=!this"]},"!proto":"!SM.prototype"}},"do_HuanXinIM":{"!url":"","!type":"fn()","prototype":{"logout":{"!type":"fn()"},"login":{"!type":"fn(username: string, password: string, f: fn(data: Node, e: ?)) -> !this","!effects":["call !2 this=!this"]},"enterChat":{"!type":"fn(userID: string, userNick: string, userIcon: string, selfNick: string, selfIcon: string, tag: string)"},"!proto":"!SM.prototype"}}},"Module":{"!type":"fn()","prototype":{"id":{"!url":"","!doc":"","!type":"string"},"loaded":{"!url":"","!doc":"","!type":"bool"},"exports":{"!url":"","!doc":"","!type":"?"},"children":{"!url":"","!doc":"","!type":"[+Module]"},"parent":{"!url":"","!doc":"","!type":"+Module"},"filename":{"!url":"","!doc":"","!type":"string"},"require":{"!url":"","!doc":"","!type":"require"}}},"!ee":{"do_SegmentView":{"indexChanged":{"!type":"Event"}},"do_IndexListView":{"longTouch":{"!type":"Event"},"touch":{"!type":"Event"}},"do_SinaWeiBo":{},"do_TencentWX":{},"do_BaiduLocation":{"result":{"!type":"Event"}},"do_Algorithm":{},"do_BaiduPush":{"message":{"!type":"Event"},"iOSMessage":{"!type":"Event"},"notificationClicked":{"!type":"Event"},"unbind":{"!type":"Event"},"bind":{"!type":"Event"}},"do_SlideListView":{"longTouch":{"!type":"Event"},"touch":{"!type":"Event"},"pull":{"!type":"Event"},"push":{"!type":"Event"}},"do_DateTimePicker":{},"do_ListView":{"longTouch":{"!type":"Event"},"touch":{"!type":"Event"},"scroll":{"!type":"Event"},"pull":{"!type":"Event"},"push":{"!type":"Event"}},"do_Camera":{},"do_FrameAnimationView":{},"do_ScrollView":{"scroll":{"!type":"Event"},"pull":{"!type":"Event"}},"do_RichLabel":{"linkTouch":{"!type":"Event"}},"do_LinearLayout":{"touch":{"!type":"Event"}},"do_AppleIAP":{},"do_Page":{"pause":{"!type":"Event"},"result":{"!type":"Event"},"loaded":{"!type":"Event"},"resume":{"!type":"Event"},"menu":{"!type":"Event"},"back":{"!type":"Event"}},"do_BarcodeView":{},"do_WebView":{"loaded":{"!type":"Event"},"start":{"!type":"Event"},"pull":{"!type":"Event"},"failed":{"!type":"Event"}},"do_Network":{"changed":{"!type":"Event"}},"do_MultiSelectComboBox":{"selectChanged":{"!type":"Event"}},"do_AssistiveTouch":{"touch":{"!type":"Event"}},"do_Button":{"touch":{"!type":"Event"},"touchDown":{"!type":"Event"},"touchUp":{"!type":"Event"}},"do_Socket":{"receive":{"!type":"Event"}},"do_SangforVPN":{},"do_External":{},"do_ImageView":{"touch":{"!type":"Event"}},"do_SQLite":{},"do_iFlyVoice":{"finished":{"!type":"Event"},"begin":{"!type":"Event"}},"do_ViewShower":{"viewChanged":{"!type":"Event"}},"do_ImageBrowser":{"longTouch":{"!type":"Event"}},"do_Notification":{},"M0011_FelixMenuButton":{"touch":{"!type":"Event"}},"do_Album":{},"do_Timer":{"tick":{"!type":"Event"}},"do_BaiduMapView":{"touchMarker":{"!type":"Event"}},"do_Http":{"progress":{"!type":"Event"},"fail":{"!type":"Event"},"success":{"!type":"Event"}},"do_App":{"loaded":{"!type":"Event"}},"do_SlideView":{"indexChanged":{"!type":"Event"}},"do_VerticalSlideView":{"indexChanged":{"!type":"Event"}},"do_MarqueeLabel":{},"do_ProgressBar1":{},"do_Global":{"broadcast":{"!type":"Event"},"background":{"!type":"Event"},"launch":{"!type":"Event"},"foreground":{"!type":"Event"}},"do_Audio":{"error":{"!type":"Event"},"playFinished":{"!type":"Event"},"recordProgress":{"!type":"Event"},"recordFinished":{"!type":"Event"},"playProgress":{"!type":"Event"}},"do_Alipay":{},"do_ProgressBar":{},"do_ExpandableListView":{"groupTouch":{"!type":"Event"},"groupCollapse":{"!type":"Event"},"childTouch":{"!type":"Event"},"groupExpand":{"!type":"Event"}},"do_CheckBox":{"checkChanged":{"!type":"Event"}},"do_SwitchView":{"changed":{"!type":"Event"}},"do_TextBox":{"focusIn":{"!type":"Event"},"focusOut":{"!type":"Event"},"textChanged":{"!type":"Event"},"enter":{"!type":"Event"}},"do_Device":{},"do_TextField":{"focusIn":{"!type":"Event"},"focusOut":{"!type":"Event"},"textChanged":{"!type":"Event"},"enter":{"!type":"Event"}},"do_UMengAnalytics":{},"do_FragmentView":{},"do_HashData":{},"do_Storage":{},"do_Animator":{},"do_ListData":{},"do_TencentQQ":{},"do_DataCache":{},"do_Label":{},"do_GridView":{"longTouch":{"!type":"Event"},"touch":{"!type":"Event"}},"M0011_share":{},"do_ProgressBar2":{},"do_VideoView":{"error":{"!type":"Event"},"finished":{"!type":"Event"}},"do_HuanXinIM":{"connection":{"!type":"Event"},"receive":{"!type":"Event"},"chatStatusChanged":{"!type":"Event"}},"do_ALayout":{"longTouch":{"!type":"Event"},"touch":{"!type":"Event"},"touchDown":{"!type":"Event"},"touchUp":{"!type":"Event"}},"do_Animation":{},"do_ComboBox":{"selectChanged":{"!type":"Event"}}},"Node":{},"!UI":{"!url":"","!type":"fn()","prototype":{"setMapping":{"!type":"fn(data: Node)"},"animate":{"!type":"fn(animation: string, f: fn(data: , e: ?)) -> !this","!effects":["call !1 this=!this"]},"visible":{"!type":"bool"},"remove":{"!type":"fn()"},"tag":{"!type":"string"},"width":{"!type":"string"},"show":{"!type":"fn(animationType: string, animationTime: number)"},"typeDesc":{"!type":"string"},"type":{"!type":"string"},"redraw":{"!type":"fn()"},"bgColor":{"!type":"string"},"id":{"!type":"string"},"height":{"!type":"string"},"hide":{"!type":"fn(animationType: string, animationTime: number)"},"bindData":{"!type":"fn(data: string, mapping: Node)"},"margin":{"!type":"string"},"y":{"!type":"number"},"!proto":"!Q.prototype","getRect":{"!type":"fn() -> Node"},"x":{"!type":"number"}}},"!MM":{"!url":"","!type":"fn()","prototype":{"setMapping":{"!type":"fn(data: Node)"},"bindData":{"!type":"fn(data: string, mapping: Node)"},"refreshData":{"!type":"fn()"},"load":{"!type":"fn(source: string, f: fn(data: , e: ?)) -> !this","!effects":["call !1 this=!this"]},"!proto":"!Q.prototype","loadSync":{"!type":"fn(source: string)"}}},"require":{"!url":"","!doc":"","!type":"fn(id: string) -> !custom:deviceone_rq"},"!SM":{"!url":"","!type":"fn()","prototype":{"!proto":"!E.prototype"}},"!Q":{"!url":"","!doc":"","!type":"fn()","prototype":{"setMapping":{"!type":"fn(data: Node, mapping: Node) -> !this"},"get":{"!type":"fn(data: [string]) -> !custom:deviceone_pp"},"set":{"!type":"fn(data: Node) -> !custom:deviceone_pp"},"bindData":{"!type":"fn(data: Node, mapping: Node) -> !this"},"refreshData":{"!type":"fn() -> !this"},"!proto":"!E.prototype"}}},"ui":{"!type":"deviceone.ui"},"mm":{"!type":"deviceone.mm"},"deviceone":{"foreach":{"!type":"fn(obj: ?, f: fn(key: string, value: ?))","!effects":["call !1 string !0.<i>"]},"ui":{"!type":"fn(id: string) -> !custom:deviceone_ui"},"mm":{"!type":"fn(id: string) -> !custom:deviceone_mm"},"sm":{"!type":"fn(id: string) -> !custom:deviceone_sm"},"foreachi":{"!type":"fn(list: [?], f: fn(index: number, value: ?))","!effects":["call !1 number !0.<i>"]},"Class":{"!type":"fn(Super: ?, init: fn()) -> !custom:deviceone_cs"},"merge":{"!type":"fn(target: ?, source: ?, source2?: ?) -> !0","!effects":["copy !1 !0","copy !2 !0"]},"print":{"!type":"fn(info: string, name?: string)"}},"sm":{"!type":"deviceone.sm"},"!name":"deviceone"}});