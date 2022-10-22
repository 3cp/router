import * as LogManager from 'aurelia-logging';
import { Container } from 'aurelia-dependency-injection';
import { History } from 'aurelia-history';
import { RouteRecognizer } from 'aurelia-route-recognizer';
import { EventAggregator } from 'aurelia-event-aggregator';

class NavigationInstruction {
    constructor(init) {
        this.plan = null;
        this.options = {};
        Object.assign(this, init);
        this.params = this.params || {};
        this.viewPortInstructions = {};
        let ancestorParams = [];
        let current = this;
        do {
            let currentParams = Object.assign({}, current.params);
            if (current.config && current.config.hasChildRouter) {
                delete currentParams[current.getWildCardName()];
            }
            ancestorParams.unshift(currentParams);
            current = current.parentInstruction;
        } while (current);
        let allParams = Object.assign({}, this.queryParams, ...ancestorParams);
        this.lifecycleArgs = [allParams, this.config, this];
    }
    getAllInstructions() {
        let instructions = [this];
        let viewPortInstructions = this.viewPortInstructions;
        for (let key in viewPortInstructions) {
            let childInstruction = viewPortInstructions[key].childNavigationInstruction;
            if (childInstruction) {
                instructions.push(...childInstruction.getAllInstructions());
            }
        }
        return instructions;
    }
    getAllPreviousInstructions() {
        return this.getAllInstructions().map(c => c.previousInstruction).filter(c => c);
    }
    addViewPortInstruction(nameOrInitOptions, strategy, moduleId, component) {
        let viewPortInstruction;
        let viewPortName = typeof nameOrInitOptions === 'string' ? nameOrInitOptions : nameOrInitOptions.name;
        const lifecycleArgs = this.lifecycleArgs;
        const config = Object.assign({}, lifecycleArgs[1], { currentViewPort: viewPortName });
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
    }
    getWildCardName() {
        let configRoute = this.config.route;
        let wildcardIndex = configRoute.lastIndexOf('*');
        return configRoute.substr(wildcardIndex + 1);
    }
    getWildcardPath() {
        let wildcardName = this.getWildCardName();
        let path = this.params[wildcardName] || '';
        let queryString = this.queryString;
        if (queryString) {
            path += '?' + queryString;
        }
        return path;
    }
    getBaseUrl() {
        let $encodeURI = encodeURI;
        let fragment = decodeURI(this.fragment);
        if (fragment === '') {
            let nonEmptyRoute = this.router.routes.find(route => {
                return route.name === this.config.name &&
                    route.route !== '';
            });
            if (nonEmptyRoute) {
                fragment = nonEmptyRoute.route;
            }
        }
        if (!this.params) {
            return $encodeURI(fragment);
        }
        let wildcardName = this.getWildCardName();
        let path = this.params[wildcardName] || '';
        if (!path) {
            return $encodeURI(fragment);
        }
        return $encodeURI(fragment.substr(0, fragment.lastIndexOf(path)));
    }
    _commitChanges(waitToSwap) {
        let router = this.router;
        router.currentInstruction = this;
        const previousInstruction = this.previousInstruction;
        if (previousInstruction) {
            previousInstruction.config.navModel.isActive = false;
        }
        this.config.navModel.isActive = true;
        router.refreshNavigation();
        let loads = [];
        let delaySwaps = [];
        let viewPortInstructions = this.viewPortInstructions;
        for (let viewPortName in viewPortInstructions) {
            let viewPortInstruction = viewPortInstructions[viewPortName];
            let viewPort = router.viewPorts[viewPortName];
            if (!viewPort) {
                throw new Error(`There was no router-view found in the view for ${viewPortInstruction.moduleId}.`);
            }
            let childNavInstruction = viewPortInstruction.childNavigationInstruction;
            if (viewPortInstruction.strategy === "replace") {
                if (childNavInstruction && childNavInstruction.parentCatchHandler) {
                    loads.push(childNavInstruction._commitChanges(waitToSwap));
                }
                else {
                    if (waitToSwap) {
                        delaySwaps.push(() => { viewPort.swap(viewPortInstruction); });
                    }
                    loads.push(viewPort
                        .process(viewPortInstruction, waitToSwap)
                        .then(() => childNavInstruction
                        ? childNavInstruction._commitChanges(waitToSwap)
                        : Promise.resolve()));
                }
            }
            else {
                if (childNavInstruction) {
                    loads.push(childNavInstruction._commitChanges(waitToSwap));
                }
            }
        }
        const promise = loads.reduce((chain, load) => {
            return chain.then(() => load).then(_delaySwaps => {
                if (_delaySwaps && _delaySwaps.length)
                    delaySwaps.push(..._delaySwaps);
            });
        }, Promise.resolve());
        return promise.then(() => {
            delaySwaps.push(() => prune(this));
            return delaySwaps;
        });
    }
    _updateTitle() {
        let router = this.router;
        let title = this._buildTitle(router.titleSeparator);
        if (title) {
            router.history.setTitle(title);
        }
    }
    _buildTitle(separator = ' | ') {
        let title = '';
        let childTitles = [];
        let navModelTitle = this.config.navModel.title;
        let instructionRouter = this.router;
        let viewPortInstructions = this.viewPortInstructions;
        if (navModelTitle) {
            title = instructionRouter.transformTitle(navModelTitle);
        }
        for (let viewPortName in viewPortInstructions) {
            let viewPortInstruction = viewPortInstructions[viewPortName];
            let child_nav_instruction = viewPortInstruction.childNavigationInstruction;
            if (child_nav_instruction) {
                let childTitle = child_nav_instruction._buildTitle(separator);
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
    }
}
const prune = (instruction) => {
    instruction.previousInstruction = null;
    instruction.plan = null;
};

class NavModel {
    constructor(router, relativeHref) {
        this.isActive = false;
        this.title = null;
        this.href = null;
        this.relativeHref = null;
        this.settings = {};
        this.config = null;
        this.router = router;
        this.relativeHref = relativeHref;
    }
    setTitle(title) {
        this.title = title;
        if (this.isActive) {
            this.router.updateTitle();
        }
    }
}

function _normalizeAbsolutePath(path, hasPushState, absolute = false) {
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
    let path = '';
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
    let routeConfigs = [];
    if (Array.isArray(config.route)) {
        for (let i = 0, ii = config.route.length; i < ii; ++i) {
            let current = Object.assign({}, config);
            current.route = config.route[i];
            routeConfigs.push(current);
        }
    }
    else {
        routeConfigs.push(Object.assign({}, config));
    }
    return routeConfigs;
}
const isRootedPath = /^#?\//;
const isAbsoluteUrl = /^([a-z][a-z0-9+\-.]*:)?\/\//i;

class RouterConfiguration {
    constructor() {
        this.instructions = [];
        this.options = {};
        this.pipelineSteps = [];
    }
    addPipelineStep(name, step) {
        if (step === null || step === undefined) {
            throw new Error('Pipeline step cannot be null or undefined.');
        }
        this.pipelineSteps.push({ name, step });
        return this;
    }
    addAuthorizeStep(step) {
        return this.addPipelineStep("authorize", step);
    }
    addPreActivateStep(step) {
        return this.addPipelineStep("preActivate", step);
    }
    addPreRenderStep(step) {
        return this.addPipelineStep("preRender", step);
    }
    addPostRenderStep(step) {
        return this.addPipelineStep("postRender", step);
    }
    fallbackRoute(fragment) {
        this._fallbackRoute = fragment;
        return this;
    }
    map(route) {
        if (Array.isArray(route)) {
            route.forEach(r => this.map(r));
            return this;
        }
        return this.mapRoute(route);
    }
    useViewPortDefaults(viewPortConfig) {
        this.viewPortDefaults = viewPortConfig;
        return this;
    }
    mapRoute(config) {
        this.instructions.push(router => {
            let routeConfigs = _ensureArrayWithSingleRoutePerConfig(config);
            let navModel;
            for (let i = 0, ii = routeConfigs.length; i < ii; ++i) {
                let routeConfig = routeConfigs[i];
                routeConfig.settings = routeConfig.settings || {};
                if (!navModel) {
                    navModel = router.createNavModel(routeConfig);
                }
                router.addRoute(routeConfig, navModel);
            }
        });
        return this;
    }
    mapUnknownRoutes(config) {
        this.unknownRouteConfig = config;
        return this;
    }
    exportToRouter(router) {
        let instructions = this.instructions;
        for (let i = 0, ii = instructions.length; i < ii; ++i) {
            instructions[i](router);
        }
        let { title, titleSeparator, unknownRouteConfig, _fallbackRoute, viewPortDefaults } = this;
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
        let pipelineSteps = this.pipelineSteps;
        let pipelineStepCount = pipelineSteps.length;
        if (pipelineStepCount) {
            if (!router.isRoot) {
                throw new Error('Pipeline steps can only be added to the root router');
            }
            let pipelineProvider = router.pipelineProvider;
            for (let i = 0, ii = pipelineStepCount; i < ii; ++i) {
                let { name, step } = pipelineSteps[i];
                pipelineProvider.addStep(name, step);
            }
        }
    }
}

class Router {
    constructor(container, history) {
        this.parent = null;
        this.options = {};
        this.viewPortDefaults = {};
        this.transformTitle = (title) => {
            if (this.parent) {
                return this.parent.transformTitle(title);
            }
            return title;
        };
        this.container = container;
        this.history = history;
        this.reset();
    }
    reset() {
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
        this._recognizer = new RouteRecognizer();
        this._childRecognizer = new RouteRecognizer();
        this._configuredPromise = new Promise(resolve => {
            this._resolveConfiguredPromise = resolve;
        });
    }
    get isRoot() {
        return !this.parent;
    }
    registerViewPort(viewPort, name) {
        name = name || 'default';
        this.viewPorts[name] = viewPort;
    }
    ensureConfigured() {
        return this._configuredPromise;
    }
    configure(callbackOrConfig) {
        this.isConfigured = true;
        let result = callbackOrConfig;
        let config;
        if (typeof callbackOrConfig === 'function') {
            config = new RouterConfiguration();
            result = callbackOrConfig(config);
        }
        return Promise
            .resolve(result)
            .then((c) => {
            if (c && c.exportToRouter) {
                config = c;
            }
            config.exportToRouter(this);
            this.isConfigured = true;
            this._resolveConfiguredPromise();
        });
    }
    navigate(fragment, options) {
        if (!this.isConfigured && this.parent) {
            return this.parent.navigate(fragment, options);
        }
        this.isExplicitNavigation = true;
        return this.history.navigate(_resolveUrl(fragment, this.baseUrl, this.history._hasPushState), options);
    }
    navigateToRoute(route, params, options) {
        let path = this.generate(route, params);
        return this.navigate(path, options);
    }
    navigateBack() {
        this.isExplicitNavigationBack = true;
        this.history.navigateBack();
    }
    createChild(container) {
        let childRouter = new Router(container || this.container.createChild(), this.history);
        childRouter.parent = this;
        return childRouter;
    }
    generate(nameOrRoute, params = {}, options = {}) {
        let recognizer = 'childRoute' in params ? this._childRecognizer : this._recognizer;
        let hasRoute = recognizer.hasRoute(nameOrRoute);
        if (!hasRoute) {
            if (this.parent) {
                return this.parent.generate(nameOrRoute, params, options);
            }
            throw new Error(`A route with name '${nameOrRoute}' could not be found. Check that \`name: '${nameOrRoute}'\` was specified in the route's config.`);
        }
        let path = recognizer.generate(nameOrRoute, params);
        let rootedPath = _createRootedPath(path, this.baseUrl, this.history._hasPushState, options.absolute);
        return options.absolute ? `${this.history.getAbsoluteRoot()}${rootedPath}` : rootedPath;
    }
    createNavModel(config) {
        let navModel = new NavModel(this, 'href' in config
            ? config.href
            : config.route);
        navModel.title = config.title;
        navModel.order = config.nav;
        navModel.href = config.href;
        navModel.settings = config.settings;
        navModel.config = config;
        return navModel;
    }
    addRoute(config, navModel) {
        if (Array.isArray(config.route)) {
            let routeConfigs = _ensureArrayWithSingleRoutePerConfig(config);
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
        let path = config.route;
        if (path.charAt(0) === '/') {
            path = path.substr(1);
        }
        let caseSensitive = config.caseSensitive === true;
        let state = this._recognizer.add({
            path: path,
            handler: config,
            caseSensitive: caseSensitive
        });
        if (path) {
            let settings = config.settings;
            delete config.settings;
            let withChild = JSON.parse(JSON.stringify(config));
            config.settings = settings;
            withChild.route = `${path}/*childRoute`;
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
        let navigation = this.navigation;
        if ((navModel.order || navModel.order === 0) && navigation.indexOf(navModel) === -1) {
            if ((!navModel.href && navModel.href !== '') && (state.types.dynamics || state.types.stars)) {
                throw new Error('Invalid route config for "' + config.route + '" : dynamic routes must specify an "href:" to be included in the navigation model.');
            }
            if (typeof navModel.order !== 'number') {
                navModel.order = ++this._fallbackOrder;
            }
            navigation.push(navModel);
            navigation.sort((a, b) => a.order - b.order);
        }
    }
    hasRoute(name) {
        return !!(this._recognizer.hasRoute(name) || this.parent && this.parent.hasRoute(name));
    }
    hasOwnRoute(name) {
        return this._recognizer.hasRoute(name);
    }
    handleUnknownRoutes(config) {
        if (!config) {
            throw new Error('Invalid unknown route handler');
        }
        this.catchAllHandler = instruction => {
            return this
                ._createRouteConfig(config, instruction)
                .then(c => {
                instruction.config = c;
                return instruction;
            });
        };
    }
    updateTitle() {
        let parentRouter = this.parent;
        if (parentRouter) {
            return parentRouter.updateTitle();
        }
        let currentInstruction = this.currentInstruction;
        if (currentInstruction) {
            currentInstruction._updateTitle();
        }
        return undefined;
    }
    refreshNavigation() {
        let nav = this.navigation;
        for (let i = 0, length = nav.length; i < length; i++) {
            let current = nav[i];
            if (!current.config.href) {
                current.href = _createRootedPath(current.relativeHref, this.baseUrl, this.history._hasPushState);
            }
            else {
                current.href = _normalizeAbsolutePath(current.config.href, this.history._hasPushState);
            }
        }
    }
    useViewPortDefaults($viewPortDefaults) {
        let viewPortDefaults = $viewPortDefaults;
        for (let viewPortName in viewPortDefaults) {
            let viewPortConfig = viewPortDefaults[viewPortName];
            this.viewPortDefaults[viewPortName] = {
                moduleId: viewPortConfig.moduleId
            };
        }
    }
    _refreshBaseUrl() {
        let parentRouter = this.parent;
        if (parentRouter) {
            this.baseUrl = generateBaseUrl(parentRouter, parentRouter.currentInstruction);
        }
    }
    _createNavigationInstruction(url = '', parentInstruction = null) {
        let fragment = url;
        let queryString = '';
        let queryIndex = url.indexOf('?');
        if (queryIndex !== -1) {
            fragment = url.substr(0, queryIndex);
            queryString = url.substr(queryIndex + 1);
        }
        let urlRecognizationResults = this._recognizer.recognize(url);
        if (!urlRecognizationResults || !urlRecognizationResults.length) {
            urlRecognizationResults = this._childRecognizer.recognize(url);
        }
        let instructionInit = {
            fragment,
            queryString,
            config: null,
            parentInstruction,
            previousInstruction: this.currentInstruction,
            router: this,
            options: {
                compareQueryParams: this.options.compareQueryParams
            }
        };
        let result;
        if (urlRecognizationResults && urlRecognizationResults.length) {
            let first = urlRecognizationResults[0];
            let instruction = new NavigationInstruction(Object.assign({}, instructionInit, {
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
            let instruction = new NavigationInstruction(Object.assign({}, instructionInit, {
                params: { path: fragment },
                queryParams: urlRecognizationResults ? urlRecognizationResults.queryParams : {},
                config: null
            }));
            result = evaluateNavigationStrategy(instruction, this.catchAllHandler);
        }
        else if (this.parent) {
            let router = this._parentCatchAllHandler(this.parent);
            if (router) {
                let newParentInstruction = this._findParentInstructionFromRouter(router, parentInstruction);
                let instruction = new NavigationInstruction(Object.assign({}, instructionInit, {
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
        return result || Promise.reject(new Error(`Route not found: ${url}`));
    }
    _findParentInstructionFromRouter(router, instruction) {
        if (instruction.router === router) {
            instruction.fragment = router.baseUrl;
            return instruction;
        }
        else if (instruction.parentInstruction) {
            return this._findParentInstructionFromRouter(router, instruction.parentInstruction);
        }
        return undefined;
    }
    _parentCatchAllHandler(router) {
        if (router.catchAllHandler) {
            return router;
        }
        else if (router.parent) {
            return this._parentCatchAllHandler(router.parent);
        }
        return false;
    }
    _createRouteConfig(config, instruction) {
        return Promise
            .resolve(config)
            .then((c) => {
            if (typeof c === 'string') {
                return { moduleId: c };
            }
            else if (typeof c === 'function') {
                return c(instruction);
            }
            return c;
        })
            .then((c) => typeof c === 'string' ? { moduleId: c } : c)
            .then((c) => {
            c.route = instruction.params.path;
            validateRouteConfig(c);
            if (!c.navModel) {
                c.navModel = this.createNavModel(c);
            }
            return c;
        });
    }
}
const generateBaseUrl = (router, instruction) => {
    return `${router.baseUrl || ''}${instruction.getBaseUrl() || ''}`;
};
const validateRouteConfig = (config) => {
    if (typeof config !== 'object') {
        throw new Error('Invalid Route Config');
    }
    if (typeof config.route !== 'string') {
        let name = config.name || '(no name)';
        throw new Error('Invalid Route Config for "' + name + '": You must specify a "route:" pattern.');
    }
    if (!('redirect' in config || config.moduleId || config.navigationStrategy || config.viewPorts)) {
        throw new Error('Invalid Route Config for "' + config.route + '": You must specify a "moduleId:", "redirect:", "navigationStrategy:", or "viewPorts:".');
    }
};
const evaluateNavigationStrategy = (instruction, evaluator, context) => {
    return Promise
        .resolve(evaluator.call(context, instruction))
        .then(() => {
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

const createNextFn = (instruction, steps) => {
    let index = -1;
    const next = function () {
        index++;
        if (index < steps.length) {
            let currentStep = steps[index];
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
const createCompletionHandler = (next, status) => {
    return (output) => Promise
        .resolve({
        status,
        output,
        completed: status === "completed"
    });
};

class Pipeline {
    constructor() {
        this.steps = [];
    }
    addStep(step) {
        let run;
        if (typeof step === 'function') {
            run = step;
        }
        else if (typeof step.getSteps === 'function') {
            let steps = step.getSteps();
            for (let i = 0, l = steps.length; i < l; i++) {
                this.addStep(steps[i]);
            }
            return this;
        }
        else {
            run = step.run.bind(step);
        }
        this.steps.push(run);
        return this;
    }
    run(instruction) {
        const nextFn = createNextFn(instruction, this.steps);
        return nextFn();
    }
}

function isNavigationCommand(obj) {
    return obj && typeof obj.navigate === 'function';
}
class Redirect {
    constructor(url, options = {}) {
        this.url = url;
        this.options = Object.assign({ trigger: true, replace: true }, options);
        this.shouldContinueProcessing = false;
    }
    setRouter(router) {
        this.router = router;
    }
    navigate(appRouter) {
        let navigatingRouter = this.options.useAppRouter ? appRouter : (this.router || appRouter);
        navigatingRouter.navigate(this.url, this.options);
    }
}
class RedirectToRoute {
    constructor(route, params = {}, options = {}) {
        this.route = route;
        this.params = params;
        this.options = Object.assign({ trigger: true, replace: true }, options);
        this.shouldContinueProcessing = false;
    }
    setRouter(router) {
        this.router = router;
    }
    navigate(appRouter) {
        let navigatingRouter = this.options.useAppRouter ? appRouter : (this.router || appRouter);
        navigatingRouter.navigateToRoute(this.route, this.params, this.options);
    }
}

function _buildNavigationPlan(instruction, forceLifecycleMinimum) {
    let config = instruction.config;
    if ('redirect' in config) {
        return buildRedirectPlan(instruction);
    }
    const prevInstruction = instruction.previousInstruction;
    const defaultViewPortConfigs = instruction.router.viewPortDefaults;
    if (prevInstruction) {
        return buildTransitionPlans(instruction, prevInstruction, defaultViewPortConfigs, forceLifecycleMinimum);
    }
    const viewPortPlans = {};
    let viewPortConfigs = config.viewPorts;
    for (let viewPortName in viewPortConfigs) {
        let viewPortConfig = viewPortConfigs[viewPortName];
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
const buildRedirectPlan = (instruction) => {
    const config = instruction.config;
    const router = instruction.router;
    return router
        ._createNavigationInstruction(config.redirect)
        .then(redirectInstruction => {
        const params = {};
        const originalInstructionParams = instruction.params;
        const redirectInstructionParams = redirectInstruction.params;
        for (let key in redirectInstructionParams) {
            let val = redirectInstructionParams[key];
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
        let redirectLocation = router.generate(redirectInstruction.config, params, instruction.options);
        for (let key in originalInstructionParams) {
            redirectLocation = redirectLocation.replace(`:${key}`, originalInstructionParams[key]);
        }
        let queryString = instruction.queryString;
        if (queryString) {
            redirectLocation += '?' + queryString;
        }
        return Promise.resolve(new Redirect(redirectLocation));
    });
};
const buildTransitionPlans = (currentInstruction, previousInstruction, defaultViewPortConfigs, forceLifecycleMinimum) => {
    let viewPortPlans = {};
    let newInstructionConfig = currentInstruction.config;
    let hasNewParams = hasDifferentParameterValues(previousInstruction, currentInstruction);
    let pending = [];
    let previousViewPortInstructions = previousInstruction.viewPortInstructions;
    for (let viewPortName in previousViewPortInstructions) {
        const prevViewPortInstruction = previousViewPortInstructions[viewPortName];
        const prevViewPortComponent = prevViewPortInstruction.component;
        const newInstructionViewPortConfigs = newInstructionConfig.viewPorts;
        let nextViewPortConfig = viewPortName in newInstructionViewPortConfigs
            ? newInstructionViewPortConfigs[viewPortName]
            : prevViewPortInstruction;
        if (nextViewPortConfig.moduleId === null && viewPortName in defaultViewPortConfigs) {
            nextViewPortConfig = defaultViewPortConfigs[viewPortName];
        }
        const viewPortActivationStrategy = determineActivationStrategy(currentInstruction, prevViewPortInstruction, nextViewPortConfig, hasNewParams, forceLifecycleMinimum);
        const viewPortPlan = viewPortPlans[viewPortName] = {
            name: viewPortName,
            config: nextViewPortConfig,
            prevComponent: prevViewPortComponent,
            prevModuleId: prevViewPortInstruction.moduleId,
            strategy: viewPortActivationStrategy
        };
        if (viewPortActivationStrategy !== "replace" && prevViewPortInstruction.childRouter) {
            const path = currentInstruction.getWildcardPath();
            const task = prevViewPortInstruction
                .childRouter
                ._createNavigationInstruction(path, currentInstruction)
                .then((childInstruction) => {
                viewPortPlan.childNavigationInstruction = childInstruction;
                return _buildNavigationPlan(childInstruction, viewPortPlan.strategy === "invoke-lifecycle")
                    .then(childPlan => {
                    if (childPlan instanceof Redirect) {
                        return Promise.reject(childPlan);
                    }
                    childInstruction.plan = childPlan;
                    return null;
                });
            });
            pending.push(task);
        }
    }
    return Promise.all(pending).then(() => viewPortPlans);
};
const determineActivationStrategy = (currentNavInstruction, prevViewPortInstruction, newViewPortConfig, hasNewParams, forceLifecycleMinimum) => {
    let newInstructionConfig = currentNavInstruction.config;
    let prevViewPortViewModel = prevViewPortInstruction.component.viewModel;
    let viewPortPlanStrategy;
    if (prevViewPortInstruction.moduleId !== newViewPortConfig.moduleId) {
        viewPortPlanStrategy = "replace";
    }
    else if ('determineActivationStrategy' in prevViewPortViewModel) {
        viewPortPlanStrategy = prevViewPortViewModel.determineActivationStrategy(...currentNavInstruction.lifecycleArgs);
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
const hasDifferentParameterValues = (prev, next) => {
    let prevParams = prev.params;
    let nextParams = next.params;
    let nextWildCardName = next.config.hasChildRouter ? next.getWildCardName() : null;
    for (let key in nextParams) {
        if (key === nextWildCardName) {
            continue;
        }
        if (prevParams[key] !== nextParams[key]) {
            return true;
        }
    }
    for (let key in prevParams) {
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
    let prevQueryParams = prev.queryParams;
    let nextQueryParams = next.queryParams;
    for (let key in nextQueryParams) {
        if (prevQueryParams[key] !== nextQueryParams[key]) {
            return true;
        }
    }
    for (let key in prevQueryParams) {
        if (prevQueryParams[key] !== nextQueryParams[key]) {
            return true;
        }
    }
    return false;
};

class BuildNavigationPlanStep {
    run(navigationInstruction, next) {
        return _buildNavigationPlan(navigationInstruction)
            .then(plan => {
            if (plan instanceof Redirect) {
                return next.cancel(plan);
            }
            navigationInstruction.plan = plan;
            return next();
        })
            .catch(next.cancel);
    }
}

const loadNewRoute = (routeLoader, navigationInstruction) => {
    let loadingPlans = determineLoadingPlans(navigationInstruction);
    let loadPromises = loadingPlans.map((loadingPlan) => loadRoute(routeLoader, loadingPlan.navigationInstruction, loadingPlan.viewPortPlan));
    return Promise.all(loadPromises);
};
const determineLoadingPlans = (navigationInstruction, loadingPlans = []) => {
    let viewPortPlans = navigationInstruction.plan;
    for (let viewPortName in viewPortPlans) {
        let viewPortPlan = viewPortPlans[viewPortName];
        let childNavInstruction = viewPortPlan.childNavigationInstruction;
        if (viewPortPlan.strategy === "replace") {
            loadingPlans.push({ viewPortPlan, navigationInstruction });
            if (childNavInstruction) {
                determineLoadingPlans(childNavInstruction, loadingPlans);
            }
        }
        else {
            let viewPortInstruction = navigationInstruction.addViewPortInstruction({
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
const loadRoute = (routeLoader, navigationInstruction, viewPortPlan) => {
    let planConfig = viewPortPlan.config;
    let moduleId = planConfig ? planConfig.moduleId : null;
    return loadComponent(routeLoader, navigationInstruction, planConfig)
        .then((component) => {
        let viewPortInstruction = navigationInstruction.addViewPortInstruction({
            name: viewPortPlan.name,
            strategy: viewPortPlan.strategy,
            moduleId: moduleId,
            component: component
        });
        let childRouter = component.childRouter;
        if (childRouter) {
            let path = navigationInstruction.getWildcardPath();
            return childRouter
                ._createNavigationInstruction(path, navigationInstruction)
                .then((childInstruction) => {
                viewPortPlan.childNavigationInstruction = childInstruction;
                return _buildNavigationPlan(childInstruction)
                    .then((childPlan) => {
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
const loadComponent = (routeLoader, navigationInstruction, config) => {
    let router = navigationInstruction.router;
    let lifecycleArgs = navigationInstruction.lifecycleArgs;
    return Promise.resolve()
        .then(() => routeLoader.loadRoute(router, config, navigationInstruction))
        .then((component) => {
        let { viewModel, childContainer } = component;
        component.router = router;
        component.config = config;
        if ('configureRouter' in viewModel) {
            let childRouter = childContainer.getChildRouter();
            component.childRouter = childRouter;
            return childRouter
                .configure(c => viewModel.configureRouter(c, childRouter, lifecycleArgs[0], lifecycleArgs[1], lifecycleArgs[2]))
                .then(() => component);
        }
        return component;
    });
};

class RouteLoader {
    loadRoute(router, config, navigationInstruction) {
        throw new Error('Route loaders must implement "loadRoute(router, config, navigationInstruction)".');
    }
}

class LoadRouteStep {
    constructor(routeLoader) {
        this.routeLoader = routeLoader;
    }
    static inject() { return [RouteLoader]; }
    run(navigationInstruction, next) {
        return loadNewRoute(this.routeLoader, navigationInstruction)
            .then(next, next.cancel);
    }
}

class CommitChangesStep {
    run(navigationInstruction, next) {
        return navigationInstruction
            ._commitChanges(true)
            .then(delayJobs => {
            return delayJobs.reduce((chain, job) => chain.then(job), Promise.resolve());
        })
            .then(() => {
            navigationInstruction._updateTitle();
            return next();
        });
    }
}

var InternalActivationStrategy;
(function (InternalActivationStrategy) {
    InternalActivationStrategy["NoChange"] = "no-change";
    InternalActivationStrategy["InvokeLifecycle"] = "invoke-lifecycle";
    InternalActivationStrategy["Replace"] = "replace";
})(InternalActivationStrategy || (InternalActivationStrategy = {}));
const activationStrategy = {
    noChange: "no-change",
    invokeLifecycle: "invoke-lifecycle",
    replace: "replace"
};

const processDeactivatable = (navigationInstruction, callbackName, next, ignoreResult) => {
    let plan = navigationInstruction.plan;
    let infos = findDeactivatable(plan, callbackName);
    let i = infos.length;
    function inspect(val) {
        if (ignoreResult || shouldContinue(val)) {
            return iterate();
        }
        return next.cancel(val);
    }
    function iterate() {
        if (i--) {
            try {
                let viewModel = infos[i];
                let result = viewModel[callbackName](navigationInstruction);
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
const findDeactivatable = (plan, callbackName, list = []) => {
    for (let viewPortName in plan) {
        let viewPortPlan = plan[viewPortName];
        let prevComponent = viewPortPlan.prevComponent;
        if ((viewPortPlan.strategy === activationStrategy.invokeLifecycle || viewPortPlan.strategy === activationStrategy.replace)
            && prevComponent) {
            let viewModel = prevComponent.viewModel;
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
const addPreviousDeactivatable = (component, callbackName, list) => {
    let childRouter = component.childRouter;
    if (childRouter && childRouter.currentInstruction) {
        let viewPortInstructions = childRouter.currentInstruction.viewPortInstructions;
        for (let viewPortName in viewPortInstructions) {
            let viewPortInstruction = viewPortInstructions[viewPortName];
            let prevComponent = viewPortInstruction.component;
            let prevViewModel = prevComponent.viewModel;
            if (callbackName in prevViewModel) {
                list.push(prevViewModel);
            }
            addPreviousDeactivatable(prevComponent, callbackName, list);
        }
    }
};
const processActivatable = (navigationInstruction, callbackName, next, ignoreResult) => {
    let infos = findActivatable(navigationInstruction, callbackName);
    let length = infos.length;
    let i = -1;
    function inspect(val, router) {
        if (ignoreResult || shouldContinue(val, router)) {
            return iterate();
        }
        return next.cancel(val);
    }
    function iterate() {
        i++;
        if (i < length) {
            try {
                let current = infos[i];
                let result = current.viewModel[callbackName](...current.lifecycleArgs);
                return processPotential(result, (val) => inspect(val, current.router), next.cancel);
            }
            catch (error) {
                return next.cancel(error);
            }
        }
        return next();
    }
    return iterate();
};
const findActivatable = (navigationInstruction, callbackName, list = [], router) => {
    let plan = navigationInstruction.plan;
    Object
        .keys(plan)
        .forEach((viewPortName) => {
        let viewPortPlan = plan[viewPortName];
        let viewPortInstruction = navigationInstruction.viewPortInstructions[viewPortName];
        let viewPortComponent = viewPortInstruction.component;
        let viewModel = viewPortComponent.viewModel;
        if ((viewPortPlan.strategy === activationStrategy.invokeLifecycle
            || viewPortPlan.strategy === activationStrategy.replace)
            && callbackName in viewModel) {
            list.push({
                viewModel,
                lifecycleArgs: viewPortInstruction.lifecycleArgs,
                router
            });
        }
        let childNavInstruction = viewPortPlan.childNavigationInstruction;
        if (childNavInstruction) {
            findActivatable(childNavInstruction, callbackName, list, viewPortComponent.childRouter || router);
        }
    });
    return list;
};
const shouldContinue = (output, router) => {
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
class SafeSubscription {
    constructor(subscriptionFunc) {
        this._subscribed = true;
        this._subscription = subscriptionFunc(this);
        if (!this._subscribed) {
            this.unsubscribe();
        }
    }
    get subscribed() {
        return this._subscribed;
    }
    unsubscribe() {
        if (this._subscribed && this._subscription) {
            this._subscription.unsubscribe();
        }
        this._subscribed = false;
    }
}
const processPotential = (obj, resolve, reject) => {
    if (obj && typeof obj.then === 'function') {
        return Promise.resolve(obj).then(resolve).catch(reject);
    }
    if (obj && typeof obj.subscribe === 'function') {
        let obs = obj;
        return new SafeSubscription(sub => obs.subscribe({
            next() {
                if (sub.subscribed) {
                    sub.unsubscribe();
                    resolve(obj);
                }
            },
            error(error) {
                if (sub.subscribed) {
                    sub.unsubscribe();
                    reject(error);
                }
            },
            complete() {
                if (sub.subscribed) {
                    sub.unsubscribe();
                    resolve(obj);
                }
            }
        }));
    }
    try {
        return resolve(obj);
    }
    catch (error) {
        return reject(error);
    }
};

class CanDeactivatePreviousStep {
    run(navigationInstruction, next) {
        return processDeactivatable(navigationInstruction, 'canDeactivate', next);
    }
}
class CanActivateNextStep {
    run(navigationInstruction, next) {
        return processActivatable(navigationInstruction, 'canActivate', next);
    }
}
class DeactivatePreviousStep {
    run(navigationInstruction, next) {
        return processDeactivatable(navigationInstruction, 'deactivate', next, true);
    }
}
class ActivateNextStep {
    run(navigationInstruction, next) {
        return processActivatable(navigationInstruction, 'activate', next, true);
    }
}

class PipelineSlot {
    constructor(container, name, alias) {
        this.steps = [];
        this.container = container;
        this.slotName = name;
        this.slotAlias = alias;
    }
    getSteps() {
        return this.steps.map(x => this.container.get(x));
    }
}
class PipelineProvider {
    constructor(container) {
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
    static inject() { return [Container]; }
    createPipeline(useCanDeactivateStep = true) {
        let pipeline = new Pipeline();
        this.steps.forEach(step => {
            if (useCanDeactivateStep || step !== CanDeactivatePreviousStep) {
                pipeline.addStep(this.container.get(step));
            }
        });
        return pipeline;
    }
    _findStep(name) {
        return this.steps.find(x => x.slotName === name || x.slotAlias === name);
    }
    addStep(name, step) {
        let found = this._findStep(name);
        if (found) {
            let slotSteps = found.steps;
            if (!slotSteps.includes(step)) {
                slotSteps.push(step);
            }
        }
        else {
            throw new Error(`Invalid pipeline slot name: ${name}.`);
        }
    }
    removeStep(name, step) {
        let slot = this._findStep(name);
        if (slot) {
            let slotSteps = slot.steps;
            slotSteps.splice(slotSteps.indexOf(step), 1);
        }
    }
    _clearSteps(name = '') {
        let slot = this._findStep(name);
        if (slot) {
            slot.steps = [];
        }
    }
    reset() {
        this._clearSteps("authorize");
        this._clearSteps("preActivate");
        this._clearSteps("preRender");
        this._clearSteps("postRender");
    }
}
const createPipelineSlot = (container, name, alias) => {
    return new PipelineSlot(container, name, alias);
};

const logger = LogManager.getLogger('app-router');
class AppRouter extends Router {
    constructor(container, history, pipelineProvider, events) {
        super(container, history);
        this.pipelineProvider = pipelineProvider;
        this.events = events;
    }
    static inject() { return [Container, History, PipelineProvider, EventAggregator]; }
    reset() {
        super.reset();
        this.maxInstructionCount = 10;
        if (!this._queue) {
            this._queue = [];
        }
        else {
            this._queue.length = 0;
        }
    }
    loadUrl(url) {
        return this
            ._createNavigationInstruction(url)
            .then(instruction => this._queueInstruction(instruction))
            .catch(error => {
            logger.error(error);
            restorePreviousLocation(this);
        });
    }
    registerViewPort(viewPort, name) {
        const $viewPort = viewPort;
        super.registerViewPort($viewPort, name);
        if (!this.isActive) {
            const viewModel = this._findViewModel($viewPort);
            if ('configureRouter' in viewModel) {
                if (!this.isConfigured) {
                    const resolveConfiguredPromise = this._resolveConfiguredPromise;
                    this._resolveConfiguredPromise = () => { };
                    return this
                        .configure(config => Promise
                        .resolve(viewModel.configureRouter(config, this))
                        .then(() => config))
                        .then(() => {
                        this.activate();
                        resolveConfiguredPromise();
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
    }
    activate(options) {
        if (this.isActive) {
            return;
        }
        this.isActive = true;
        this.options = Object.assign({ routeHandler: this.loadUrl.bind(this) }, this.options, options);
        this.history.activate(this.options);
        this._dequeueInstruction();
    }
    deactivate() {
        this.isActive = false;
        this.history.deactivate();
    }
    _queueInstruction(instruction) {
        return new Promise((resolve) => {
            instruction.resolve = resolve;
            this._queue.unshift(instruction);
            this._dequeueInstruction();
        });
    }
    _dequeueInstruction(instructionCount = 0) {
        return Promise.resolve().then(() => {
            if (this.isNavigating && !instructionCount) {
                return void 0;
            }
            let instruction = this._queue.shift();
            this._queue.length = 0;
            if (!instruction) {
                return void 0;
            }
            this.isNavigating = true;
            let navtracker = this.history.getState('NavigationTracker');
            let currentNavTracker = this.currentNavigationTracker;
            if (!navtracker && !currentNavTracker) {
                this.isNavigatingFirst = true;
                this.isNavigatingNew = true;
            }
            else if (!navtracker) {
                this.isNavigatingNew = true;
            }
            else if (!currentNavTracker) {
                this.isNavigatingRefresh = true;
            }
            else if (currentNavTracker < navtracker) {
                this.isNavigatingForward = true;
            }
            else if (currentNavTracker > navtracker) {
                this.isNavigatingBack = true;
            }
            if (!navtracker) {
                navtracker = Date.now();
                this.history.setState('NavigationTracker', navtracker);
            }
            this.currentNavigationTracker = navtracker;
            instruction.previousInstruction = this.currentInstruction;
            let maxInstructionCount = this.maxInstructionCount;
            if (!instructionCount) {
                this.events.publish("router:navigation:processing", { instruction });
            }
            else if (instructionCount === maxInstructionCount - 1) {
                logger.error(`${instructionCount + 1} navigation instructions have been attempted without success. Restoring last known good location.`);
                restorePreviousLocation(this);
                return this._dequeueInstruction(instructionCount + 1);
            }
            else if (instructionCount > maxInstructionCount) {
                throw new Error('Maximum navigation attempts exceeded. Giving up.');
            }
            let pipeline = this.pipelineProvider.createPipeline(!this.couldDeactivate);
            return pipeline
                .run(instruction)
                .then(result => processResult(instruction, result, instructionCount, this))
                .catch(error => {
                return { output: error instanceof Error ? error : new Error(error) };
            })
                .then(result => resolveInstruction(instruction, result, !!instructionCount, this));
        });
    }
    _findViewModel(viewPort) {
        if (this.container.viewModel) {
            return this.container.viewModel;
        }
        if (viewPort.container) {
            let container = viewPort.container;
            while (container) {
                if (container.viewModel) {
                    this.container.viewModel = container.viewModel;
                    return container.viewModel;
                }
                container = container.parent;
            }
        }
        return undefined;
    }
}
const processResult = (instruction, result, instructionCount, router) => {
    if (!(result && 'completed' in result && 'output' in result)) {
        result = result || {};
        result.output = new Error(`Expected router pipeline to return a navigation result, but got [${JSON.stringify(result)}] instead.`);
    }
    let finalResult = null;
    let navigationCommandResult = null;
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
        .then(() => router._dequeueInstruction(instructionCount + 1))
        .then(innerResult => finalResult || innerResult || result);
};
const resolveInstruction = (instruction, result, isInnerInstruction, router) => {
    instruction.resolve(result);
    let eventAggregator = router.events;
    let eventArgs = { instruction, result };
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
        let eventName;
        if (result.output instanceof Error) {
            eventName = "router:navigation:error";
        }
        else if (!result.completed) {
            eventName = "router:navigation:canceled";
        }
        else {
            let queryString = instruction.queryString ? ('?' + instruction.queryString) : '';
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
const restorePreviousLocation = (router) => {
    let previousLocation = router.history.previousLocation;
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

var PipelineStatus;
(function (PipelineStatus) {
    PipelineStatus["Completed"] = "completed";
    PipelineStatus["Canceled"] = "canceled";
    PipelineStatus["Rejected"] = "rejected";
    PipelineStatus["Running"] = "running";
})(PipelineStatus || (PipelineStatus = {}));

var RouterEvent;
(function (RouterEvent) {
    RouterEvent["Processing"] = "router:navigation:processing";
    RouterEvent["Error"] = "router:navigation:error";
    RouterEvent["Canceled"] = "router:navigation:canceled";
    RouterEvent["Complete"] = "router:navigation:complete";
    RouterEvent["Success"] = "router:navigation:success";
    RouterEvent["ChildComplete"] = "router:navigation:child:complete";
})(RouterEvent || (RouterEvent = {}));

var PipelineSlotName;
(function (PipelineSlotName) {
    PipelineSlotName["Authorize"] = "authorize";
    PipelineSlotName["PreActivate"] = "preActivate";
    PipelineSlotName["PreRender"] = "preRender";
    PipelineSlotName["PostRender"] = "postRender";
})(PipelineSlotName || (PipelineSlotName = {}));

export { ActivateNextStep, AppRouter, BuildNavigationPlanStep, CanActivateNextStep, CanDeactivatePreviousStep, CommitChangesStep, DeactivatePreviousStep, LoadRouteStep, NavModel, NavigationInstruction, Pipeline, PipelineProvider, PipelineSlotName, PipelineStatus, Redirect, RedirectToRoute, RouteLoader, Router, RouterConfiguration, RouterEvent, activationStrategy, isNavigationCommand };
//# sourceMappingURL=aurelia-router.js.map
