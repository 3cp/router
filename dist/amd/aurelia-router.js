define('aurelia-router', ['exports', 'aurelia-logging', 'aurelia-dependency-injection', 'aurelia-history', 'aurelia-route-recognizer', 'aurelia-event-aggregator'], (function (exports, LogManager, aureliaDependencyInjection, aureliaHistory, aureliaRouteRecognizer, aureliaEventAggregator) { 'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n["default"] = e;
        return Object.freeze(n);
    }

    var LogManager__namespace = /*#__PURE__*/_interopNamespace(LogManager);

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    }

    var NavigationInstruction = (function () {
        function NavigationInstruction(init) {
            this.plan = null;
            this.options = {};
            Object.assign(this, init);
            this.params = this.params || {};
            this.viewPortInstructions = {};
            var ancestorParams = [];
            var current = this;
            do {
                var currentParams = Object.assign({}, current.params);
                if (current.config && current.config.hasChildRouter) {
                    delete currentParams[current.getWildCardName()];
                }
                ancestorParams.unshift(currentParams);
                current = current.parentInstruction;
            } while (current);
            var allParams = Object.assign.apply(Object, __spreadArray([{}, this.queryParams], ancestorParams, false));
            this.lifecycleArgs = [allParams, this.config, this];
        }
        NavigationInstruction.prototype.getAllInstructions = function () {
            var instructions = [this];
            var viewPortInstructions = this.viewPortInstructions;
            for (var key in viewPortInstructions) {
                var childInstruction = viewPortInstructions[key].childNavigationInstruction;
                if (childInstruction) {
                    instructions.push.apply(instructions, childInstruction.getAllInstructions());
                }
            }
            return instructions;
        };
        NavigationInstruction.prototype.getAllPreviousInstructions = function () {
            return this.getAllInstructions().map(function (c) { return c.previousInstruction; }).filter(function (c) { return c; });
        };
        NavigationInstruction.prototype.addViewPortInstruction = function (nameOrInitOptions, strategy, moduleId, component) {
            var viewPortInstruction;
            var viewPortName = typeof nameOrInitOptions === 'string' ? nameOrInitOptions : nameOrInitOptions.name;
            var lifecycleArgs = this.lifecycleArgs;
            var config = Object.assign({}, lifecycleArgs[1], { currentViewPort: viewPortName });
            if (typeof nameOrInitOptions === 'string') {
                viewPortInstruction = {
                    name: nameOrInitOptions,
                    strategy: strategy,
                    moduleId: moduleId,
                    component: component,
                    childRouter: component.childRouter,
                    lifecycleArgs: [lifecycleArgs[0], config, lifecycleArgs[2]]
                };
            }
            else {
                viewPortInstruction = {
                    name: viewPortName,
                    strategy: nameOrInitOptions.strategy,
                    component: nameOrInitOptions.component,
                    moduleId: nameOrInitOptions.moduleId,
                    childRouter: nameOrInitOptions.component.childRouter,
                    lifecycleArgs: [lifecycleArgs[0], config, lifecycleArgs[2]]
                };
            }
            return this.viewPortInstructions[viewPortName] = viewPortInstruction;
        };
        NavigationInstruction.prototype.getWildCardName = function () {
            var configRoute = this.config.route;
            var wildcardIndex = configRoute.lastIndexOf('*');
            return configRoute.substr(wildcardIndex + 1);
        };
        NavigationInstruction.prototype.getWildcardPath = function () {
            var wildcardName = this.getWildCardName();
            var path = this.params[wildcardName] || '';
            var queryString = this.queryString;
            if (queryString) {
                path += '?' + queryString;
            }
            return path;
        };
        NavigationInstruction.prototype.getBaseUrl = function () {
            var _this = this;
            var $encodeURI = encodeURI;
            var fragment = decodeURI(this.fragment);
            if (fragment === '') {
                var nonEmptyRoute = this.router.routes.find(function (route) {
                    return route.name === _this.config.name &&
                        route.route !== '';
                });
                if (nonEmptyRoute) {
                    fragment = nonEmptyRoute.route;
                }
            }
            if (!this.params) {
                return $encodeURI(fragment);
            }
            var wildcardName = this.getWildCardName();
            var path = this.params[wildcardName] || '';
            if (!path) {
                return $encodeURI(fragment);
            }
            return $encodeURI(fragment.substr(0, fragment.lastIndexOf(path)));
        };
        NavigationInstruction.prototype._commitChanges = function (waitToSwap) {
            var _this = this;
            var router = this.router;
            router.currentInstruction = this;
            var previousInstruction = this.previousInstruction;
            if (previousInstruction) {
                previousInstruction.config.navModel.isActive = false;
            }
            this.config.navModel.isActive = true;
            router.refreshNavigation();
            var loads = [];
            var delaySwaps = [];
            var viewPortInstructions = this.viewPortInstructions;
            var _loop_1 = function (viewPortName) {
                var viewPortInstruction = viewPortInstructions[viewPortName];
                var viewPort = router.viewPorts[viewPortName];
                if (!viewPort) {
                    throw new Error("There was no router-view found in the view for ".concat(viewPortInstruction.moduleId, "."));
                }
                var childNavInstruction = viewPortInstruction.childNavigationInstruction;
                if (viewPortInstruction.strategy === "replace") {
                    if (childNavInstruction && childNavInstruction.parentCatchHandler) {
                        loads.push(childNavInstruction._commitChanges(waitToSwap));
                    }
                    else {
                        if (waitToSwap) {
                            delaySwaps.push(function () { viewPort.swap(viewPortInstruction); });
                        }
                        loads.push(viewPort
                            .process(viewPortInstruction, waitToSwap)
                            .then(function () { return childNavInstruction
                            ? childNavInstruction._commitChanges(waitToSwap)
                            : Promise.resolve(); }));
                    }
                }
                else {
                    if (childNavInstruction) {
                        loads.push(childNavInstruction._commitChanges(waitToSwap));
                    }
                }
            };
            for (var viewPortName in viewPortInstructions) {
                _loop_1(viewPortName);
            }
            var promise = loads.reduce(function (chain, load) {
                return chain.then(function () { return load; }).then(function (_delaySwaps) {
                    if (_delaySwaps && _delaySwaps.length)
                        delaySwaps.push.apply(delaySwaps, _delaySwaps);
                });
            }, Promise.resolve());
            return promise.then(function () {
                delaySwaps.push(function () { return prune(_this); });
                return delaySwaps;
            });
        };
        NavigationInstruction.prototype._updateTitle = function () {
            var router = this.router;
            var title = this._buildTitle(router.titleSeparator);
            if (title) {
                router.history.setTitle(title);
            }
        };
        NavigationInstruction.prototype._buildTitle = function (separator) {
            if (separator === void 0) { separator = ' | '; }
            var title = '';
            var childTitles = [];
            var navModelTitle = this.config.navModel.title;
            var instructionRouter = this.router;
            var viewPortInstructions = this.viewPortInstructions;
            if (navModelTitle) {
                title = instructionRouter.transformTitle(navModelTitle);
            }
            for (var viewPortName in viewPortInstructions) {
                var viewPortInstruction = viewPortInstructions[viewPortName];
                var child_nav_instruction = viewPortInstruction.childNavigationInstruction;
                if (child_nav_instruction) {
                    var childTitle = child_nav_instruction._buildTitle(separator);
                    if (childTitle) {
                        childTitles.push(childTitle);
                    }
                }
            }
            if (childTitles.length) {
                title = childTitles.join(separator) + (title ? separator : '') + title;
            }
            if (instructionRouter.title) {
                title += (title ? separator : '') + instructionRouter.transformTitle(instructionRouter.title);
            }
            return title;
        };
        return NavigationInstruction;
    }());
    var prune = function (instruction) {
        instruction.previousInstruction = null;
        instruction.plan = null;
    };

    var NavModel = (function () {
        function NavModel(router, relativeHref) {
            this.isActive = false;
            this.title = null;
            this.href = null;
            this.relativeHref = null;
            this.settings = {};
            this.config = null;
            this.router = router;
            this.relativeHref = relativeHref;
        }
        NavModel.prototype.setTitle = function (title) {
            this.title = title;
            if (this.isActive) {
                this.router.updateTitle();
            }
        };
        return NavModel;
    }());

    function _normalizeAbsolutePath(path, hasPushState, absolute) {
        if (absolute === void 0) { absolute = false; }
        if (!hasPushState && path[0] !== '#') {
            path = '#' + path;
        }
        if (hasPushState && absolute) {
            path = path.substring(1, path.length);
        }
        return path;
    }
    function _createRootedPath(fragment, baseUrl, hasPushState, absolute) {
        if (isAbsoluteUrl.test(fragment)) {
            return fragment;
        }
        var path = '';
        if (baseUrl.length && baseUrl[0] !== '/') {
            path += '/';
        }
        path += baseUrl;
        if ((!path.length || path[path.length - 1] !== '/') && fragment[0] !== '/') {
            path += '/';
        }
        if (path.length && path[path.length - 1] === '/' && fragment[0] === '/') {
            path = path.substring(0, path.length - 1);
        }
        return _normalizeAbsolutePath(path + fragment, hasPushState, absolute);
    }
    function _resolveUrl(fragment, baseUrl, hasPushState) {
        if (isRootedPath.test(fragment)) {
            return _normalizeAbsolutePath(fragment, hasPushState);
        }
        return _createRootedPath(fragment, baseUrl, hasPushState);
    }
    function _ensureArrayWithSingleRoutePerConfig(config) {
        var routeConfigs = [];
        if (Array.isArray(config.route)) {
            for (var i = 0, ii = config.route.length; i < ii; ++i) {
                var current = Object.assign({}, config);
                current.route = config.route[i];
                routeConfigs.push(current);
            }
        }
        else {
            routeConfigs.push(Object.assign({}, config));
        }
        return routeConfigs;
    }
    var isRootedPath = /^#?\//;
    var isAbsoluteUrl = /^([a-z][a-z0-9+\-.]*:)?\/\//i;

    var RouterConfiguration = (function () {
        function RouterConfiguration() {
            this.instructions = [];
            this.options = {};
            this.pipelineSteps = [];
        }
        RouterConfiguration.prototype.addPipelineStep = function (name, step) {
            if (step === null || step === undefined) {
                throw new Error('Pipeline step cannot be null or undefined.');
            }
            this.pipelineSteps.push({ name: name, step: step });
            return this;
        };
        RouterConfiguration.prototype.addAuthorizeStep = function (step) {
            return this.addPipelineStep("authorize", step);
        };
        RouterConfiguration.prototype.addPreActivateStep = function (step) {
            return this.addPipelineStep("preActivate", step);
        };
        RouterConfiguration.prototype.addPreRenderStep = function (step) {
            return this.addPipelineStep("preRender", step);
        };
        RouterConfiguration.prototype.addPostRenderStep = function (step) {
            return this.addPipelineStep("postRender", step);
        };
        RouterConfiguration.prototype.fallbackRoute = function (fragment) {
            this._fallbackRoute = fragment;
            return this;
        };
        RouterConfiguration.prototype.map = function (route) {
            var _this = this;
            if (Array.isArray(route)) {
                route.forEach(function (r) { return _this.map(r); });
                return this;
            }
            return this.mapRoute(route);
        };
        RouterConfiguration.prototype.useViewPortDefaults = function (viewPortConfig) {
            this.viewPortDefaults = viewPortConfig;
            return this;
        };
        RouterConfiguration.prototype.mapRoute = function (config) {
            this.instructions.push(function (router) {
                var routeConfigs = _ensureArrayWithSingleRoutePerConfig(config);
                var navModel;
                for (var i = 0, ii = routeConfigs.length; i < ii; ++i) {
                    var routeConfig = routeConfigs[i];
                    routeConfig.settings = routeConfig.settings || {};
                    if (!navModel) {
                        navModel = router.createNavModel(routeConfig);
                    }
                    router.addRoute(routeConfig, navModel);
                }
            });
            return this;
        };
        RouterConfiguration.prototype.mapUnknownRoutes = function (config) {
            this.unknownRouteConfig = config;
            return this;
        };
        RouterConfiguration.prototype.exportToRouter = function (router) {
            var instructions = this.instructions;
            for (var i = 0, ii = instructions.length; i < ii; ++i) {
                instructions[i](router);
            }
            var _a = this, title = _a.title, titleSeparator = _a.titleSeparator, unknownRouteConfig = _a.unknownRouteConfig, _fallbackRoute = _a._fallbackRoute, viewPortDefaults = _a.viewPortDefaults;
            if (title) {
                router.title = title;
            }
            if (titleSeparator) {
                router.titleSeparator = titleSeparator;
            }
            if (unknownRouteConfig) {
                router.handleUnknownRoutes(unknownRouteConfig);
            }
            if (_fallbackRoute) {
                router.fallbackRoute = _fallbackRoute;
            }
            if (viewPortDefaults) {
                router.useViewPortDefaults(viewPortDefaults);
            }
            Object.assign(router.options, this.options);
            var pipelineSteps = this.pipelineSteps;
            var pipelineStepCount = pipelineSteps.length;
            if (pipelineStepCount) {
                if (!router.isRoot) {
                    throw new Error('Pipeline steps can only be added to the root router');
                }
                var pipelineProvider = router.pipelineProvider;
                for (var i = 0, ii = pipelineStepCount; i < ii; ++i) {
                    var _b = pipelineSteps[i], name_1 = _b.name, step = _b.step;
                    pipelineProvider.addStep(name_1, step);
                }
            }
        };
        return RouterConfiguration;
    }());

    var Router = (function () {
        function Router(container, history) {
            var _this = this;
            this.parent = null;
            this.options = {};
            this.viewPortDefaults = {};
            this.transformTitle = function (title) {
                if (_this.parent) {
                    return _this.parent.transformTitle(title);
                }
                return title;
            };
            this.container = container;
            this.history = history;
            this.reset();
        }
        Router.prototype.reset = function () {
            var _this = this;
            this.viewPorts = {};
            this.routes = [];
            this.baseUrl = '';
            this.isConfigured = false;
            this.isNavigating = false;
            this.isExplicitNavigation = false;
            this.isExplicitNavigationBack = false;
            this.isNavigatingFirst = false;
            this.isNavigatingNew = false;
            this.isNavigatingRefresh = false;
            this.isNavigatingForward = false;
            this.isNavigatingBack = false;
            this.couldDeactivate = false;
            this.navigation = [];
            this.currentInstruction = null;
            this.viewPortDefaults = {};
            this._fallbackOrder = 100;
            this._recognizer = new aureliaRouteRecognizer.RouteRecognizer();
            this._childRecognizer = new aureliaRouteRecognizer.RouteRecognizer();
            this._configuredPromise = new Promise(function (resolve) {
                _this._resolveConfiguredPromise = resolve;
            });
        };
        Object.defineProperty(Router.prototype, "isRoot", {
            get: function () {
                return !this.parent;
            },
            enumerable: false,
            configurable: true
        });
        Router.prototype.registerViewPort = function (viewPort, name) {
            name = name || 'default';
            this.viewPorts[name] = viewPort;
        };
        Router.prototype.ensureConfigured = function () {
            return this._configuredPromise;
        };
        Router.prototype.configure = function (callbackOrConfig) {
            var _this = this;
            this.isConfigured = true;
            var result = callbackOrConfig;
            var config;
            if (typeof callbackOrConfig === 'function') {
                config = new RouterConfiguration();
                result = callbackOrConfig(config);
            }
            return Promise
                .resolve(result)
                .then(function (c) {
                if (c && c.exportToRouter) {
                    config = c;
                }
                config.exportToRouter(_this);
                _this.isConfigured = true;
                _this._resolveConfiguredPromise();
            });
        };
        Router.prototype.navigate = function (fragment, options) {
            if (!this.isConfigured && this.parent) {
                return this.parent.navigate(fragment, options);
            }
            this.isExplicitNavigation = true;
            return this.history.navigate(_resolveUrl(fragment, this.baseUrl, this.history._hasPushState), options);
        };
        Router.prototype.navigateToRoute = function (route, params, options) {
            var path = this.generate(route, params);
            return this.navigate(path, options);
        };
        Router.prototype.navigateBack = function () {
            this.isExplicitNavigationBack = true;
            this.history.navigateBack();
        };
        Router.prototype.createChild = function (container) {
            var childRouter = new Router(container || this.container.createChild(), this.history);
            childRouter.parent = this;
            return childRouter;
        };
        Router.prototype.generate = function (nameOrRoute, params, options) {
            if (params === void 0) { params = {}; }
            if (options === void 0) { options = {}; }
            var recognizer = 'childRoute' in params ? this._childRecognizer : this._recognizer;
            var hasRoute = recognizer.hasRoute(nameOrRoute);
            if (!hasRoute) {
                if (this.parent) {
                    return this.parent.generate(nameOrRoute, params, options);
                }
                throw new Error("A route with name '".concat(nameOrRoute, "' could not be found. Check that `name: '").concat(nameOrRoute, "'` was specified in the route's config."));
            }
            var path = recognizer.generate(nameOrRoute, params);
            var rootedPath = _createRootedPath(path, this.baseUrl, this.history._hasPushState, options.absolute);
            return options.absolute ? "".concat(this.history.getAbsoluteRoot()).concat(rootedPath) : rootedPath;
        };
        Router.prototype.createNavModel = function (config) {
            var navModel = new NavModel(this, 'href' in config
                ? config.href
                : config.route);
            navModel.title = config.title;
            navModel.order = config.nav;
            navModel.href = config.href;
            navModel.settings = config.settings;
            navModel.config = config;
            return navModel;
        };
        Router.prototype.addRoute = function (config, navModel) {
            if (Array.isArray(config.route)) {
                var routeConfigs = _ensureArrayWithSingleRoutePerConfig(config);
                routeConfigs.forEach(this.addRoute.bind(this));
                return;
            }
            validateRouteConfig(config);
            if (!('viewPorts' in config) && !config.navigationStrategy) {
                config.viewPorts = {
                    'default': {
                        moduleId: config.moduleId,
                        view: config.view
                    }
                };
            }
            if (!navModel) {
                navModel = this.createNavModel(config);
            }
            this.routes.push(config);
            var path = config.route;
            if (path.charAt(0) === '/') {
                path = path.substr(1);
            }
            var caseSensitive = config.caseSensitive === true;
            var state = this._recognizer.add({
                path: path,
                handler: config,
                caseSensitive: caseSensitive
            });
            if (path) {
                var settings = config.settings;
                delete config.settings;
                var withChild = JSON.parse(JSON.stringify(config));
                config.settings = settings;
                withChild.route = "".concat(path, "/*childRoute");
                withChild.hasChildRouter = true;
                this._childRecognizer.add({
                    path: withChild.route,
                    handler: withChild,
                    caseSensitive: caseSensitive
                });
                withChild.navModel = navModel;
                withChild.settings = config.settings;
                withChild.navigationStrategy = config.navigationStrategy;
            }
            config.navModel = navModel;
            var navigation = this.navigation;
            if ((navModel.order || navModel.order === 0) && navigation.indexOf(navModel) === -1) {
                if ((!navModel.href && navModel.href !== '') && (state.types.dynamics || state.types.stars)) {
                    throw new Error('Invalid route config for "' + config.route + '" : dynamic routes must specify an "href:" to be included in the navigation model.');
                }
                if (typeof navModel.order !== 'number') {
                    navModel.order = ++this._fallbackOrder;
                }
                navigation.push(navModel);
                navigation.sort(function (a, b) { return a.order - b.order; });
            }
        };
        Router.prototype.hasRoute = function (name) {
            return !!(this._recognizer.hasRoute(name) || this.parent && this.parent.hasRoute(name));
        };
        Router.prototype.hasOwnRoute = function (name) {
            return this._recognizer.hasRoute(name);
        };
        Router.prototype.handleUnknownRoutes = function (config) {
            var _this = this;
            if (!config) {
                throw new Error('Invalid unknown route handler');
            }
            this.catchAllHandler = function (instruction) {
                return _this
                    ._createRouteConfig(config, instruction)
                    .then(function (c) {
                    instruction.config = c;
                    return instruction;
                });
            };
        };
        Router.prototype.updateTitle = function () {
            var parentRouter = this.parent;
            if (parentRouter) {
                return parentRouter.updateTitle();
            }
            var currentInstruction = this.currentInstruction;
            if (currentInstruction) {
                currentInstruction._updateTitle();
            }
            return undefined;
        };
        Router.prototype.refreshNavigation = function () {
            var nav = this.navigation;
            for (var i = 0, length_1 = nav.length; i < length_1; i++) {
                var current = nav[i];
                if (!current.config.href) {
                    current.href = _createRootedPath(current.relativeHref, this.baseUrl, this.history._hasPushState);
                }
                else {
                    current.href = _normalizeAbsolutePath(current.config.href, this.history._hasPushState);
                }
            }
        };
        Router.prototype.useViewPortDefaults = function ($viewPortDefaults) {
            var viewPortDefaults = $viewPortDefaults;
            for (var viewPortName in viewPortDefaults) {
                var viewPortConfig = viewPortDefaults[viewPortName];
                this.viewPortDefaults[viewPortName] = {
                    moduleId: viewPortConfig.moduleId
                };
            }
        };
        Router.prototype._refreshBaseUrl = function () {
            var parentRouter = this.parent;
            if (parentRouter) {
                this.baseUrl = generateBaseUrl(parentRouter, parentRouter.currentInstruction);
            }
        };
        Router.prototype._createNavigationInstruction = function (url, parentInstruction) {
            if (url === void 0) { url = ''; }
            if (parentInstruction === void 0) { parentInstruction = null; }
            var fragment = url;
            var queryString = '';
            var queryIndex = url.indexOf('?');
            if (queryIndex !== -1) {
                fragment = url.substr(0, queryIndex);
                queryString = url.substr(queryIndex + 1);
            }
            var urlRecognizationResults = this._recognizer.recognize(url);
            if (!urlRecognizationResults || !urlRecognizationResults.length) {
                urlRecognizationResults = this._childRecognizer.recognize(url);
            }
            var instructionInit = {
                fragment: fragment,
                queryString: queryString,
                config: null,
                parentInstruction: parentInstruction,
                previousInstruction: this.currentInstruction,
                router: this,
                options: {
                    compareQueryParams: this.options.compareQueryParams
                }
            };
            var result;
            if (urlRecognizationResults && urlRecognizationResults.length) {
                var first = urlRecognizationResults[0];
                var instruction = new NavigationInstruction(Object.assign({}, instructionInit, {
                    params: first.params,
                    queryParams: first.queryParams || urlRecognizationResults.queryParams,
                    config: first.config || first.handler
                }));
                if (typeof first.handler === 'function') {
                    result = evaluateNavigationStrategy(instruction, first.handler, first);
                }
                else if (first.handler && typeof first.handler.navigationStrategy === 'function') {
                    result = evaluateNavigationStrategy(instruction, first.handler.navigationStrategy, first.handler);
                }
                else {
                    result = Promise.resolve(instruction);
                }
            }
            else if (this.catchAllHandler) {
                var instruction = new NavigationInstruction(Object.assign({}, instructionInit, {
                    params: { path: fragment },
                    queryParams: urlRecognizationResults ? urlRecognizationResults.queryParams : {},
                    config: null
                }));
                result = evaluateNavigationStrategy(instruction, this.catchAllHandler);
            }
            else if (this.parent) {
                var router = this._parentCatchAllHandler(this.parent);
                if (router) {
                    var newParentInstruction = this._findParentInstructionFromRouter(router, parentInstruction);
                    var instruction = new NavigationInstruction(Object.assign({}, instructionInit, {
                        params: { path: fragment },
                        queryParams: urlRecognizationResults ? urlRecognizationResults.queryParams : {},
                        router: router,
                        parentInstruction: newParentInstruction,
                        parentCatchHandler: true,
                        config: null
                    }));
                    result = evaluateNavigationStrategy(instruction, router.catchAllHandler);
                }
            }
            if (result && parentInstruction) {
                this.baseUrl = generateBaseUrl(this.parent, parentInstruction);
            }
            return result || Promise.reject(new Error("Route not found: ".concat(url)));
        };
        Router.prototype._findParentInstructionFromRouter = function (router, instruction) {
            if (instruction.router === router) {
                instruction.fragment = router.baseUrl;
                return instruction;
            }
            else if (instruction.parentInstruction) {
                return this._findParentInstructionFromRouter(router, instruction.parentInstruction);
            }
            return undefined;
        };
        Router.prototype._parentCatchAllHandler = function (router) {
            if (router.catchAllHandler) {
                return router;
            }
            else if (router.parent) {
                return this._parentCatchAllHandler(router.parent);
            }
            return false;
        };
        Router.prototype._createRouteConfig = function (config, instruction) {
            var _this = this;
            return Promise
                .resolve(config)
                .then(function (c) {
                if (typeof c === 'string') {
                    return { moduleId: c };
                }
                else if (typeof c === 'function') {
                    return c(instruction);
                }
                return c;
            })
                .then(function (c) { return typeof c === 'string' ? { moduleId: c } : c; })
                .then(function (c) {
                c.route = instruction.params.path;
                validateRouteConfig(c);
                if (!c.navModel) {
                    c.navModel = _this.createNavModel(c);
                }
                return c;
            });
        };
        return Router;
    }());
    var generateBaseUrl = function (router, instruction) {
        return "".concat(router.baseUrl || '').concat(instruction.getBaseUrl() || '');
    };
    var validateRouteConfig = function (config) {
        if (typeof config !== 'object') {
            throw new Error('Invalid Route Config');
        }
        if (typeof config.route !== 'string') {
            var name_1 = config.name || '(no name)';
            throw new Error('Invalid Route Config for "' + name_1 + '": You must specify a "route:" pattern.');
        }
        if (!('redirect' in config || config.moduleId || config.navigationStrategy || config.viewPorts)) {
            throw new Error('Invalid Route Config for "' + config.route + '": You must specify a "moduleId:", "redirect:", "navigationStrategy:", or "viewPorts:".');
        }
    };
    var evaluateNavigationStrategy = function (instruction, evaluator, context) {
        return Promise
            .resolve(evaluator.call(context, instruction))
            .then(function () {
            if (!('viewPorts' in instruction.config)) {
                instruction.config.viewPorts = {
                    'default': {
                        moduleId: instruction.config.moduleId
                    }
                };
            }
            return instruction;
        });
    };

    var createNextFn = function (instruction, steps) {
        var index = -1;
        var next = function () {
            index++;
            if (index < steps.length) {
                var currentStep = steps[index];
                try {
                    return currentStep(instruction, next);
                }
                catch (e) {
                    return next.reject(e);
                }
            }
            else {
                return next.complete();
            }
        };
        next.complete = createCompletionHandler(next, "completed");
        next.cancel = createCompletionHandler(next, "canceled");
        next.reject = createCompletionHandler(next, "rejected");
        return next;
    };
    var createCompletionHandler = function (next, status) {
        return function (output) { return Promise
            .resolve({
            status: status,
            output: output,
            completed: status === "completed"
        }); };
    };

    var Pipeline = (function () {
        function Pipeline() {
            this.steps = [];
        }
        Pipeline.prototype.addStep = function (step) {
            var run;
            if (typeof step === 'function') {
                run = step;
            }
            else if (typeof step.getSteps === 'function') {
                var steps = step.getSteps();
                for (var i = 0, l = steps.length; i < l; i++) {
                    this.addStep(steps[i]);
                }
                return this;
            }
            else {
                run = step.run.bind(step);
            }
            this.steps.push(run);
            return this;
        };
        Pipeline.prototype.run = function (instruction) {
            var nextFn = createNextFn(instruction, this.steps);
            return nextFn();
        };
        return Pipeline;
    }());

    function isNavigationCommand(obj) {
        return obj && typeof obj.navigate === 'function';
    }
    var Redirect = (function () {
        function Redirect(url, options) {
            if (options === void 0) { options = {}; }
            this.url = url;
            this.options = Object.assign({ trigger: true, replace: true }, options);
            this.shouldContinueProcessing = false;
        }
        Redirect.prototype.setRouter = function (router) {
            this.router = router;
        };
        Redirect.prototype.navigate = function (appRouter) {
            var navigatingRouter = this.options.useAppRouter ? appRouter : (this.router || appRouter);
            navigatingRouter.navigate(this.url, this.options);
        };
        return Redirect;
    }());
    var RedirectToRoute = (function () {
        function RedirectToRoute(route, params, options) {
            if (params === void 0) { params = {}; }
            if (options === void 0) { options = {}; }
            this.route = route;
            this.params = params;
            this.options = Object.assign({ trigger: true, replace: true }, options);
            this.shouldContinueProcessing = false;
        }
        RedirectToRoute.prototype.setRouter = function (router) {
            this.router = router;
        };
        RedirectToRoute.prototype.navigate = function (appRouter) {
            var navigatingRouter = this.options.useAppRouter ? appRouter : (this.router || appRouter);
            navigatingRouter.navigateToRoute(this.route, this.params, this.options);
        };
        return RedirectToRoute;
    }());

    function _buildNavigationPlan(instruction, forceLifecycleMinimum) {
        var config = instruction.config;
        if ('redirect' in config) {
            return buildRedirectPlan(instruction);
        }
        var prevInstruction = instruction.previousInstruction;
        var defaultViewPortConfigs = instruction.router.viewPortDefaults;
        if (prevInstruction) {
            return buildTransitionPlans(instruction, prevInstruction, defaultViewPortConfigs, forceLifecycleMinimum);
        }
        var viewPortPlans = {};
        var viewPortConfigs = config.viewPorts;
        for (var viewPortName in viewPortConfigs) {
            var viewPortConfig = viewPortConfigs[viewPortName];
            if (viewPortConfig.moduleId === null && viewPortName in defaultViewPortConfigs) {
                viewPortConfig = defaultViewPortConfigs[viewPortName];
            }
            viewPortPlans[viewPortName] = {
                name: viewPortName,
                strategy: "replace",
                config: viewPortConfig
            };
        }
        return Promise.resolve(viewPortPlans);
    }
    var buildRedirectPlan = function (instruction) {
        var config = instruction.config;
        var router = instruction.router;
        return router
            ._createNavigationInstruction(config.redirect)
            .then(function (redirectInstruction) {
            var params = {};
            var originalInstructionParams = instruction.params;
            var redirectInstructionParams = redirectInstruction.params;
            for (var key in redirectInstructionParams) {
                var val = redirectInstructionParams[key];
                if (typeof val === 'string' && val[0] === ':') {
                    val = val.slice(1);
                    if (val in originalInstructionParams) {
                        params[key] = originalInstructionParams[val];
                    }
                }
                else {
                    params[key] = redirectInstructionParams[key];
                }
            }
            var redirectLocation = router.generate(redirectInstruction.config, params, instruction.options);
            for (var key in originalInstructionParams) {
                redirectLocation = redirectLocation.replace(":".concat(key), originalInstructionParams[key]);
            }
            var queryString = instruction.queryString;
            if (queryString) {
                redirectLocation += '?' + queryString;
            }
            return Promise.resolve(new Redirect(redirectLocation));
        });
    };
    var buildTransitionPlans = function (currentInstruction, previousInstruction, defaultViewPortConfigs, forceLifecycleMinimum) {
        var viewPortPlans = {};
        var newInstructionConfig = currentInstruction.config;
        var hasNewParams = hasDifferentParameterValues(previousInstruction, currentInstruction);
        var pending = [];
        var previousViewPortInstructions = previousInstruction.viewPortInstructions;
        var _loop_1 = function (viewPortName) {
            var prevViewPortInstruction = previousViewPortInstructions[viewPortName];
            var prevViewPortComponent = prevViewPortInstruction.component;
            var newInstructionViewPortConfigs = newInstructionConfig.viewPorts;
            var nextViewPortConfig = viewPortName in newInstructionViewPortConfigs
                ? newInstructionViewPortConfigs[viewPortName]
                : prevViewPortInstruction;
            if (nextViewPortConfig.moduleId === null && viewPortName in defaultViewPortConfigs) {
                nextViewPortConfig = defaultViewPortConfigs[viewPortName];
            }
            var viewPortActivationStrategy = determineActivationStrategy(currentInstruction, prevViewPortInstruction, nextViewPortConfig, hasNewParams, forceLifecycleMinimum);
            var viewPortPlan = viewPortPlans[viewPortName] = {
                name: viewPortName,
                config: nextViewPortConfig,
                prevComponent: prevViewPortComponent,
                prevModuleId: prevViewPortInstruction.moduleId,
                strategy: viewPortActivationStrategy
            };
            if (viewPortActivationStrategy !== "replace" && prevViewPortInstruction.childRouter) {
                var path = currentInstruction.getWildcardPath();
                var task = prevViewPortInstruction
                    .childRouter
                    ._createNavigationInstruction(path, currentInstruction)
                    .then(function (childInstruction) {
                    viewPortPlan.childNavigationInstruction = childInstruction;
                    return _buildNavigationPlan(childInstruction, viewPortPlan.strategy === "invoke-lifecycle")
                        .then(function (childPlan) {
                        if (childPlan instanceof Redirect) {
                            return Promise.reject(childPlan);
                        }
                        childInstruction.plan = childPlan;
                        return null;
                    });
                });
                pending.push(task);
            }
        };
        for (var viewPortName in previousViewPortInstructions) {
            _loop_1(viewPortName);
        }
        return Promise.all(pending).then(function () { return viewPortPlans; });
    };
    var determineActivationStrategy = function (currentNavInstruction, prevViewPortInstruction, newViewPortConfig, hasNewParams, forceLifecycleMinimum) {
        var newInstructionConfig = currentNavInstruction.config;
        var prevViewPortViewModel = prevViewPortInstruction.component.viewModel;
        var viewPortPlanStrategy;
        if (prevViewPortInstruction.moduleId !== newViewPortConfig.moduleId) {
            viewPortPlanStrategy = "replace";
        }
        else if ('determineActivationStrategy' in prevViewPortViewModel) {
            viewPortPlanStrategy = prevViewPortViewModel.determineActivationStrategy.apply(prevViewPortViewModel, currentNavInstruction.lifecycleArgs);
        }
        else if (newInstructionConfig.activationStrategy) {
            viewPortPlanStrategy = newInstructionConfig.activationStrategy;
        }
        else if (hasNewParams || forceLifecycleMinimum) {
            viewPortPlanStrategy = "invoke-lifecycle";
        }
        else {
            viewPortPlanStrategy = "no-change";
        }
        return viewPortPlanStrategy;
    };
    var hasDifferentParameterValues = function (prev, next) {
        var prevParams = prev.params;
        var nextParams = next.params;
        var nextWildCardName = next.config.hasChildRouter ? next.getWildCardName() : null;
        for (var key in nextParams) {
            if (key === nextWildCardName) {
                continue;
            }
            if (prevParams[key] !== nextParams[key]) {
                return true;
            }
        }
        for (var key in prevParams) {
            if (key === nextWildCardName) {
                continue;
            }
            if (prevParams[key] !== nextParams[key]) {
                return true;
            }
        }
        if (!next.options.compareQueryParams) {
            return false;
        }
        var prevQueryParams = prev.queryParams;
        var nextQueryParams = next.queryParams;
        for (var key in nextQueryParams) {
            if (prevQueryParams[key] !== nextQueryParams[key]) {
                return true;
            }
        }
        for (var key in prevQueryParams) {
            if (prevQueryParams[key] !== nextQueryParams[key]) {
                return true;
            }
        }
        return false;
    };

    var BuildNavigationPlanStep = (function () {
        function BuildNavigationPlanStep() {
        }
        BuildNavigationPlanStep.prototype.run = function (navigationInstruction, next) {
            return _buildNavigationPlan(navigationInstruction)
                .then(function (plan) {
                if (plan instanceof Redirect) {
                    return next.cancel(plan);
                }
                navigationInstruction.plan = plan;
                return next();
            })
                .catch(next.cancel);
        };
        return BuildNavigationPlanStep;
    }());

    var loadNewRoute = function (routeLoader, navigationInstruction) {
        var loadingPlans = determineLoadingPlans(navigationInstruction);
        var loadPromises = loadingPlans.map(function (loadingPlan) { return loadRoute(routeLoader, loadingPlan.navigationInstruction, loadingPlan.viewPortPlan); });
        return Promise.all(loadPromises);
    };
    var determineLoadingPlans = function (navigationInstruction, loadingPlans) {
        if (loadingPlans === void 0) { loadingPlans = []; }
        var viewPortPlans = navigationInstruction.plan;
        for (var viewPortName in viewPortPlans) {
            var viewPortPlan = viewPortPlans[viewPortName];
            var childNavInstruction = viewPortPlan.childNavigationInstruction;
            if (viewPortPlan.strategy === "replace") {
                loadingPlans.push({ viewPortPlan: viewPortPlan, navigationInstruction: navigationInstruction });
                if (childNavInstruction) {
                    determineLoadingPlans(childNavInstruction, loadingPlans);
                }
            }
            else {
                var viewPortInstruction = navigationInstruction.addViewPortInstruction({
                    name: viewPortName,
                    strategy: viewPortPlan.strategy,
                    moduleId: viewPortPlan.prevModuleId,
                    component: viewPortPlan.prevComponent
                });
                if (childNavInstruction) {
                    viewPortInstruction.childNavigationInstruction = childNavInstruction;
                    determineLoadingPlans(childNavInstruction, loadingPlans);
                }
            }
        }
        return loadingPlans;
    };
    var loadRoute = function (routeLoader, navigationInstruction, viewPortPlan) {
        var planConfig = viewPortPlan.config;
        var moduleId = planConfig ? planConfig.moduleId : null;
        return loadComponent(routeLoader, navigationInstruction, planConfig)
            .then(function (component) {
            var viewPortInstruction = navigationInstruction.addViewPortInstruction({
                name: viewPortPlan.name,
                strategy: viewPortPlan.strategy,
                moduleId: moduleId,
                component: component
            });
            var childRouter = component.childRouter;
            if (childRouter) {
                var path = navigationInstruction.getWildcardPath();
                return childRouter
                    ._createNavigationInstruction(path, navigationInstruction)
                    .then(function (childInstruction) {
                    viewPortPlan.childNavigationInstruction = childInstruction;
                    return _buildNavigationPlan(childInstruction)
                        .then(function (childPlan) {
                        if (childPlan instanceof Redirect) {
                            return Promise.reject(childPlan);
                        }
                        childInstruction.plan = childPlan;
                        viewPortInstruction.childNavigationInstruction = childInstruction;
                        return loadNewRoute(routeLoader, childInstruction);
                    });
                });
            }
            return void 0;
        });
    };
    var loadComponent = function (routeLoader, navigationInstruction, config) {
        var router = navigationInstruction.router;
        var lifecycleArgs = navigationInstruction.lifecycleArgs;
        return Promise.resolve()
            .then(function () { return routeLoader.loadRoute(router, config, navigationInstruction); })
            .then(function (component) {
            var viewModel = component.viewModel, childContainer = component.childContainer;
            component.router = router;
            component.config = config;
            if ('configureRouter' in viewModel) {
                var childRouter_1 = childContainer.getChildRouter();
                component.childRouter = childRouter_1;
                return childRouter_1
                    .configure(function (c) { return viewModel.configureRouter(c, childRouter_1, lifecycleArgs[0], lifecycleArgs[1], lifecycleArgs[2]); })
                    .then(function () { return component; });
            }
            return component;
        });
    };

    var RouteLoader = (function () {
        function RouteLoader() {
        }
        RouteLoader.prototype.loadRoute = function (router, config, navigationInstruction) {
            throw new Error('Route loaders must implement "loadRoute(router, config, navigationInstruction)".');
        };
        return RouteLoader;
    }());

    var LoadRouteStep = (function () {
        function LoadRouteStep(routeLoader) {
            this.routeLoader = routeLoader;
        }
        LoadRouteStep.inject = function () { return [RouteLoader]; };
        LoadRouteStep.prototype.run = function (navigationInstruction, next) {
            return loadNewRoute(this.routeLoader, navigationInstruction)
                .then(next, next.cancel);
        };
        return LoadRouteStep;
    }());

    var CommitChangesStep = (function () {
        function CommitChangesStep() {
        }
        CommitChangesStep.prototype.run = function (navigationInstruction, next) {
            return navigationInstruction
                ._commitChanges(true)
                .then(function (delayJobs) {
                return delayJobs.reduce(function (chain, job) { return chain.then(job); }, Promise.resolve());
            })
                .then(function () {
                navigationInstruction._updateTitle();
                return next();
            });
        };
        return CommitChangesStep;
    }());

    var InternalActivationStrategy;
    (function (InternalActivationStrategy) {
        InternalActivationStrategy["NoChange"] = "no-change";
        InternalActivationStrategy["InvokeLifecycle"] = "invoke-lifecycle";
        InternalActivationStrategy["Replace"] = "replace";
    })(InternalActivationStrategy || (InternalActivationStrategy = {}));
    var activationStrategy = {
        noChange: "no-change",
        invokeLifecycle: "invoke-lifecycle",
        replace: "replace"
    };

    var processDeactivatable = function (navigationInstruction, callbackName, next, ignoreResult) {
        var plan = navigationInstruction.plan;
        var infos = findDeactivatable(plan, callbackName);
        var i = infos.length;
        function inspect(val) {
            if (ignoreResult || shouldContinue(val)) {
                return iterate();
            }
            return next.cancel(val);
        }
        function iterate() {
            if (i--) {
                try {
                    var viewModel = infos[i];
                    var result = viewModel[callbackName](navigationInstruction);
                    return processPotential(result, inspect, next.cancel);
                }
                catch (error) {
                    return next.cancel(error);
                }
            }
            navigationInstruction.router.couldDeactivate = true;
            return next();
        }
        return iterate();
    };
    var findDeactivatable = function (plan, callbackName, list) {
        if (list === void 0) { list = []; }
        for (var viewPortName in plan) {
            var viewPortPlan = plan[viewPortName];
            var prevComponent = viewPortPlan.prevComponent;
            if ((viewPortPlan.strategy === activationStrategy.invokeLifecycle || viewPortPlan.strategy === activationStrategy.replace)
                && prevComponent) {
                var viewModel = prevComponent.viewModel;
                if (callbackName in viewModel) {
                    list.push(viewModel);
                }
            }
            if (viewPortPlan.strategy === activationStrategy.replace && prevComponent) {
                addPreviousDeactivatable(prevComponent, callbackName, list);
            }
            else if (viewPortPlan.childNavigationInstruction) {
                findDeactivatable(viewPortPlan.childNavigationInstruction.plan, callbackName, list);
            }
        }
        return list;
    };
    var addPreviousDeactivatable = function (component, callbackName, list) {
        var childRouter = component.childRouter;
        if (childRouter && childRouter.currentInstruction) {
            var viewPortInstructions = childRouter.currentInstruction.viewPortInstructions;
            for (var viewPortName in viewPortInstructions) {
                var viewPortInstruction = viewPortInstructions[viewPortName];
                var prevComponent = viewPortInstruction.component;
                var prevViewModel = prevComponent.viewModel;
                if (callbackName in prevViewModel) {
                    list.push(prevViewModel);
                }
                addPreviousDeactivatable(prevComponent, callbackName, list);
            }
        }
    };
    var processActivatable = function (navigationInstruction, callbackName, next, ignoreResult) {
        var infos = findActivatable(navigationInstruction, callbackName);
        var length = infos.length;
        var i = -1;
        function inspect(val, router) {
            if (ignoreResult || shouldContinue(val, router)) {
                return iterate();
            }
            return next.cancel(val);
        }
        function iterate() {
            var _a;
            i++;
            if (i < length) {
                try {
                    var current_1 = infos[i];
                    var result = (_a = current_1.viewModel)[callbackName].apply(_a, current_1.lifecycleArgs);
                    return processPotential(result, function (val) { return inspect(val, current_1.router); }, next.cancel);
                }
                catch (error) {
                    return next.cancel(error);
                }
            }
            return next();
        }
        return iterate();
    };
    var findActivatable = function (navigationInstruction, callbackName, list, router) {
        if (list === void 0) { list = []; }
        var plan = navigationInstruction.plan;
        Object
            .keys(plan)
            .forEach(function (viewPortName) {
            var viewPortPlan = plan[viewPortName];
            var viewPortInstruction = navigationInstruction.viewPortInstructions[viewPortName];
            var viewPortComponent = viewPortInstruction.component;
            var viewModel = viewPortComponent.viewModel;
            if ((viewPortPlan.strategy === activationStrategy.invokeLifecycle
                || viewPortPlan.strategy === activationStrategy.replace)
                && callbackName in viewModel) {
                list.push({
                    viewModel: viewModel,
                    lifecycleArgs: viewPortInstruction.lifecycleArgs,
                    router: router
                });
            }
            var childNavInstruction = viewPortPlan.childNavigationInstruction;
            if (childNavInstruction) {
                findActivatable(childNavInstruction, callbackName, list, viewPortComponent.childRouter || router);
            }
        });
        return list;
    };
    var shouldContinue = function (output, router) {
        if (output instanceof Error) {
            return false;
        }
        if (isNavigationCommand(output)) {
            if (typeof output.setRouter === 'function') {
                output.setRouter(router);
            }
            return !!output.shouldContinueProcessing;
        }
        if (output === undefined) {
            return true;
        }
        return output;
    };
    var SafeSubscription = (function () {
        function SafeSubscription(subscriptionFunc) {
            this._subscribed = true;
            this._subscription = subscriptionFunc(this);
            if (!this._subscribed) {
                this.unsubscribe();
            }
        }
        Object.defineProperty(SafeSubscription.prototype, "subscribed", {
            get: function () {
                return this._subscribed;
            },
            enumerable: false,
            configurable: true
        });
        SafeSubscription.prototype.unsubscribe = function () {
            if (this._subscribed && this._subscription) {
                this._subscription.unsubscribe();
            }
            this._subscribed = false;
        };
        return SafeSubscription;
    }());
    var processPotential = function (obj, resolve, reject) {
        if (obj && typeof obj.then === 'function') {
            return Promise.resolve(obj).then(resolve).catch(reject);
        }
        if (obj && typeof obj.subscribe === 'function') {
            var obs_1 = obj;
            return new SafeSubscription(function (sub) { return obs_1.subscribe({
                next: function () {
                    if (sub.subscribed) {
                        sub.unsubscribe();
                        resolve(obj);
                    }
                },
                error: function (error) {
                    if (sub.subscribed) {
                        sub.unsubscribe();
                        reject(error);
                    }
                },
                complete: function () {
                    if (sub.subscribed) {
                        sub.unsubscribe();
                        resolve(obj);
                    }
                }
            }); });
        }
        try {
            return resolve(obj);
        }
        catch (error) {
            return reject(error);
        }
    };

    var CanDeactivatePreviousStep = (function () {
        function CanDeactivatePreviousStep() {
        }
        CanDeactivatePreviousStep.prototype.run = function (navigationInstruction, next) {
            return processDeactivatable(navigationInstruction, 'canDeactivate', next);
        };
        return CanDeactivatePreviousStep;
    }());
    var CanActivateNextStep = (function () {
        function CanActivateNextStep() {
        }
        CanActivateNextStep.prototype.run = function (navigationInstruction, next) {
            return processActivatable(navigationInstruction, 'canActivate', next);
        };
        return CanActivateNextStep;
    }());
    var DeactivatePreviousStep = (function () {
        function DeactivatePreviousStep() {
        }
        DeactivatePreviousStep.prototype.run = function (navigationInstruction, next) {
            return processDeactivatable(navigationInstruction, 'deactivate', next, true);
        };
        return DeactivatePreviousStep;
    }());
    var ActivateNextStep = (function () {
        function ActivateNextStep() {
        }
        ActivateNextStep.prototype.run = function (navigationInstruction, next) {
            return processActivatable(navigationInstruction, 'activate', next, true);
        };
        return ActivateNextStep;
    }());

    var PipelineSlot = (function () {
        function PipelineSlot(container, name, alias) {
            this.steps = [];
            this.container = container;
            this.slotName = name;
            this.slotAlias = alias;
        }
        PipelineSlot.prototype.getSteps = function () {
            var _this = this;
            return this.steps.map(function (x) { return _this.container.get(x); });
        };
        return PipelineSlot;
    }());
    var PipelineProvider = (function () {
        function PipelineProvider(container) {
            this.container = container;
            this.steps = [
                BuildNavigationPlanStep,
                CanDeactivatePreviousStep,
                LoadRouteStep,
                createPipelineSlot(container, "authorize"),
                CanActivateNextStep,
                createPipelineSlot(container, "preActivate", 'modelbind'),
                DeactivatePreviousStep,
                ActivateNextStep,
                createPipelineSlot(container, "preRender", 'precommit'),
                CommitChangesStep,
                createPipelineSlot(container, "postRender", 'postcomplete')
            ];
        }
        PipelineProvider.inject = function () { return [aureliaDependencyInjection.Container]; };
        PipelineProvider.prototype.createPipeline = function (useCanDeactivateStep) {
            var _this = this;
            if (useCanDeactivateStep === void 0) { useCanDeactivateStep = true; }
            var pipeline = new Pipeline();
            this.steps.forEach(function (step) {
                if (useCanDeactivateStep || step !== CanDeactivatePreviousStep) {
                    pipeline.addStep(_this.container.get(step));
                }
            });
            return pipeline;
        };
        PipelineProvider.prototype._findStep = function (name) {
            return this.steps.find(function (x) { return x.slotName === name || x.slotAlias === name; });
        };
        PipelineProvider.prototype.addStep = function (name, step) {
            var found = this._findStep(name);
            if (found) {
                var slotSteps = found.steps;
                if (!slotSteps.includes(step)) {
                    slotSteps.push(step);
                }
            }
            else {
                throw new Error("Invalid pipeline slot name: ".concat(name, "."));
            }
        };
        PipelineProvider.prototype.removeStep = function (name, step) {
            var slot = this._findStep(name);
            if (slot) {
                var slotSteps = slot.steps;
                slotSteps.splice(slotSteps.indexOf(step), 1);
            }
        };
        PipelineProvider.prototype._clearSteps = function (name) {
            if (name === void 0) { name = ''; }
            var slot = this._findStep(name);
            if (slot) {
                slot.steps = [];
            }
        };
        PipelineProvider.prototype.reset = function () {
            this._clearSteps("authorize");
            this._clearSteps("preActivate");
            this._clearSteps("preRender");
            this._clearSteps("postRender");
        };
        return PipelineProvider;
    }());
    var createPipelineSlot = function (container, name, alias) {
        return new PipelineSlot(container, name, alias);
    };

    var logger = LogManager__namespace.getLogger('app-router');
    var AppRouter = (function (_super) {
        __extends(AppRouter, _super);
        function AppRouter(container, history, pipelineProvider, events) {
            var _this = _super.call(this, container, history) || this;
            _this.pipelineProvider = pipelineProvider;
            _this.events = events;
            return _this;
        }
        AppRouter.inject = function () { return [aureliaDependencyInjection.Container, aureliaHistory.History, PipelineProvider, aureliaEventAggregator.EventAggregator]; };
        AppRouter.prototype.reset = function () {
            _super.prototype.reset.call(this);
            this.maxInstructionCount = 10;
            if (!this._queue) {
                this._queue = [];
            }
            else {
                this._queue.length = 0;
            }
        };
        AppRouter.prototype.loadUrl = function (url) {
            var _this = this;
            return this
                ._createNavigationInstruction(url)
                .then(function (instruction) { return _this._queueInstruction(instruction); })
                .catch(function (error) {
                logger.error(error);
                restorePreviousLocation(_this);
            });
        };
        AppRouter.prototype.registerViewPort = function (viewPort, name) {
            var _this = this;
            var $viewPort = viewPort;
            _super.prototype.registerViewPort.call(this, $viewPort, name);
            if (!this.isActive) {
                var viewModel_1 = this._findViewModel($viewPort);
                if ('configureRouter' in viewModel_1) {
                    if (!this.isConfigured) {
                        var resolveConfiguredPromise_1 = this._resolveConfiguredPromise;
                        this._resolveConfiguredPromise = function () { };
                        return this
                            .configure(function (config) {
                            return Promise
                                .resolve(viewModel_1.configureRouter(config, _this))
                                .then(function () { return config; });
                        })
                            .then(function () {
                            _this.activate();
                            resolveConfiguredPromise_1();
                        });
                    }
                }
                else {
                    this.activate();
                }
            }
            else {
                this._dequeueInstruction();
            }
            return Promise.resolve();
        };
        AppRouter.prototype.activate = function (options) {
            if (this.isActive) {
                return;
            }
            this.isActive = true;
            this.options = Object.assign({ routeHandler: this.loadUrl.bind(this) }, this.options, options);
            this.history.activate(this.options);
            this._dequeueInstruction();
        };
        AppRouter.prototype.deactivate = function () {
            this.isActive = false;
            this.history.deactivate();
        };
        AppRouter.prototype._queueInstruction = function (instruction) {
            var _this = this;
            return new Promise(function (resolve) {
                instruction.resolve = resolve;
                _this._queue.unshift(instruction);
                _this._dequeueInstruction();
            });
        };
        AppRouter.prototype._dequeueInstruction = function (instructionCount) {
            var _this = this;
            if (instructionCount === void 0) { instructionCount = 0; }
            return Promise.resolve().then(function () {
                if (_this.isNavigating && !instructionCount) {
                    return void 0;
                }
                var instruction = _this._queue.shift();
                _this._queue.length = 0;
                if (!instruction) {
                    return void 0;
                }
                _this.isNavigating = true;
                var navtracker = _this.history.getState('NavigationTracker');
                var currentNavTracker = _this.currentNavigationTracker;
                if (!navtracker && !currentNavTracker) {
                    _this.isNavigatingFirst = true;
                    _this.isNavigatingNew = true;
                }
                else if (!navtracker) {
                    _this.isNavigatingNew = true;
                }
                else if (!currentNavTracker) {
                    _this.isNavigatingRefresh = true;
                }
                else if (currentNavTracker < navtracker) {
                    _this.isNavigatingForward = true;
                }
                else if (currentNavTracker > navtracker) {
                    _this.isNavigatingBack = true;
                }
                if (!navtracker) {
                    navtracker = Date.now();
                    _this.history.setState('NavigationTracker', navtracker);
                }
                _this.currentNavigationTracker = navtracker;
                instruction.previousInstruction = _this.currentInstruction;
                var maxInstructionCount = _this.maxInstructionCount;
                if (!instructionCount) {
                    _this.events.publish("router:navigation:processing", { instruction: instruction });
                }
                else if (instructionCount === maxInstructionCount - 1) {
                    logger.error("".concat(instructionCount + 1, " navigation instructions have been attempted without success. Restoring last known good location."));
                    restorePreviousLocation(_this);
                    return _this._dequeueInstruction(instructionCount + 1);
                }
                else if (instructionCount > maxInstructionCount) {
                    throw new Error('Maximum navigation attempts exceeded. Giving up.');
                }
                var pipeline = _this.pipelineProvider.createPipeline(!_this.couldDeactivate);
                return pipeline
                    .run(instruction)
                    .then(function (result) { return processResult(instruction, result, instructionCount, _this); })
                    .catch(function (error) {
                    return { output: error instanceof Error ? error : new Error(error) };
                })
                    .then(function (result) { return resolveInstruction(instruction, result, !!instructionCount, _this); });
            });
        };
        AppRouter.prototype._findViewModel = function (viewPort) {
            if (this.container.viewModel) {
                return this.container.viewModel;
            }
            if (viewPort.container) {
                var container = viewPort.container;
                while (container) {
                    if (container.viewModel) {
                        this.container.viewModel = container.viewModel;
                        return container.viewModel;
                    }
                    container = container.parent;
                }
            }
            return undefined;
        };
        return AppRouter;
    }(Router));
    var processResult = function (instruction, result, instructionCount, router) {
        if (!(result && 'completed' in result && 'output' in result)) {
            result = result || {};
            result.output = new Error("Expected router pipeline to return a navigation result, but got [".concat(JSON.stringify(result), "] instead."));
        }
        var finalResult = null;
        var navigationCommandResult = null;
        if (isNavigationCommand(result.output)) {
            navigationCommandResult = result.output.navigate(router);
        }
        else {
            finalResult = result;
            if (!result.completed) {
                if (result.output instanceof Error) {
                    logger.error(result.output.toString());
                }
                restorePreviousLocation(router);
            }
        }
        return Promise.resolve(navigationCommandResult)
            .then(function () { return router._dequeueInstruction(instructionCount + 1); })
            .then(function (innerResult) { return finalResult || innerResult || result; });
    };
    var resolveInstruction = function (instruction, result, isInnerInstruction, router) {
        instruction.resolve(result);
        var eventAggregator = router.events;
        var eventArgs = { instruction: instruction, result: result };
        if (!isInnerInstruction) {
            router.isNavigating = false;
            router.isExplicitNavigation = false;
            router.isExplicitNavigationBack = false;
            router.isNavigatingFirst = false;
            router.isNavigatingNew = false;
            router.isNavigatingRefresh = false;
            router.isNavigatingForward = false;
            router.isNavigatingBack = false;
            router.couldDeactivate = false;
            var eventName = void 0;
            if (result.output instanceof Error) {
                eventName = "router:navigation:error";
            }
            else if (!result.completed) {
                eventName = "router:navigation:canceled";
            }
            else {
                var queryString = instruction.queryString ? ('?' + instruction.queryString) : '';
                router.history.previousLocation = instruction.fragment + queryString;
                eventName = "router:navigation:success";
            }
            eventAggregator.publish(eventName, eventArgs);
            eventAggregator.publish("router:navigation:complete", eventArgs);
        }
        else {
            eventAggregator.publish("router:navigation:child:complete", eventArgs);
        }
        return result;
    };
    var restorePreviousLocation = function (router) {
        var previousLocation = router.history.previousLocation;
        if (previousLocation) {
            router.navigate(previousLocation, { trigger: false, replace: true });
        }
        else if (router.fallbackRoute) {
            router.navigate(router.fallbackRoute, { trigger: true, replace: true });
        }
        else {
            logger.error('Router navigation failed, and no previous location or fallbackRoute could be restored.');
        }
    };

    exports.PipelineStatus = void 0;
    (function (PipelineStatus) {
        PipelineStatus["Completed"] = "completed";
        PipelineStatus["Canceled"] = "canceled";
        PipelineStatus["Rejected"] = "rejected";
        PipelineStatus["Running"] = "running";
    })(exports.PipelineStatus || (exports.PipelineStatus = {}));

    exports.RouterEvent = void 0;
    (function (RouterEvent) {
        RouterEvent["Processing"] = "router:navigation:processing";
        RouterEvent["Error"] = "router:navigation:error";
        RouterEvent["Canceled"] = "router:navigation:canceled";
        RouterEvent["Complete"] = "router:navigation:complete";
        RouterEvent["Success"] = "router:navigation:success";
        RouterEvent["ChildComplete"] = "router:navigation:child:complete";
    })(exports.RouterEvent || (exports.RouterEvent = {}));

    exports.PipelineSlotName = void 0;
    (function (PipelineSlotName) {
        PipelineSlotName["Authorize"] = "authorize";
        PipelineSlotName["PreActivate"] = "preActivate";
        PipelineSlotName["PreRender"] = "preRender";
        PipelineSlotName["PostRender"] = "postRender";
    })(exports.PipelineSlotName || (exports.PipelineSlotName = {}));

    exports.ActivateNextStep = ActivateNextStep;
    exports.AppRouter = AppRouter;
    exports.BuildNavigationPlanStep = BuildNavigationPlanStep;
    exports.CanActivateNextStep = CanActivateNextStep;
    exports.CanDeactivatePreviousStep = CanDeactivatePreviousStep;
    exports.CommitChangesStep = CommitChangesStep;
    exports.DeactivatePreviousStep = DeactivatePreviousStep;
    exports.LoadRouteStep = LoadRouteStep;
    exports.NavModel = NavModel;
    exports.NavigationInstruction = NavigationInstruction;
    exports.Pipeline = Pipeline;
    exports.PipelineProvider = PipelineProvider;
    exports.Redirect = Redirect;
    exports.RedirectToRoute = RedirectToRoute;
    exports.RouteLoader = RouteLoader;
    exports.Router = Router;
    exports.RouterConfiguration = RouterConfiguration;
    exports.activationStrategy = activationStrategy;
    exports.isNavigationCommand = isNavigationCommand;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=aurelia-router.js.map
