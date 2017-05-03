(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        var dependencies = [
            'lodash',
            'jquery',
            'khoaijs',
            'khoaijs-event-emitter'
        ];

        define(dependencies, function (_, jQuery, Khoai, EventEmitter) {
            var args = Array.prototype.slice.call(arguments);
            var module = factory.apply(null, args);

            Khoai.Component = module;
            root.Component = module;

            return module;
        });
    } else {
        var module = factory(
            root._,
            root.jQuery,
            root.Khoai,
            root.Khoai.EventEmitter || root.EventEmitter
        );

        root.Khoai.Component = module;
        root.Component = module;
    }
}(this, function (_, jQuery, Khoai, EventEmitter) {
    var component_classes = {},
        component_defined = {};

    function getID() {
        return Khoai.util.nextID('component_', true);
    }

    function Component(name) {
        EventEmitter.call(this);

        this.id = getID();
        this.name = name;
        this.options = {};
        this.render_handler = null;
        this.value_handler = null;

        this.is_rendered = false;
        this.stores = {};

        /**
         *
         * @type {string}
         */
        this.store_field = null;

        /**
         *
         * @type {function}
         */
        this.store_data_handler = null;

        init(this);
    }

    Khoai.util.inherit(Component, EventEmitter);
    Component.prototype.trigger = Component.prototype.emitEvent;

    /**
     *
     * @param option
     * @param {*|undefined} [value] Bypass when parameter name is object
     * @returns {Component}
     */
    Component.prototype.option = function (option, value) {
        this.options = Khoai.util.setup.apply(null, [this.options].concat(_.toArray(arguments)));

        this.emitEvent('option_changed');

        return this;
    };

    /**
     * Get component's options
     * @return {{}}
     */
    Component.prototype.getOptions = function () {
        return _.cloneDeep(this.options);
    };

    /**
     * Get component content
     * Events:
     * - compiled: <compiled content>
     *
     * @returns {string}
     * @throws Error Component render handler must be a function or string
     */
    Component.prototype.compile = function () {
        var content;

        if (_.isFunction(this.render_handler)) {
            content = this.render_handler.bind(this)(this);
        } else {
            content = String(this.render_handler);
        }

        this.emitEvent('compiled', content);

        return content;
    };

    /**
     * Trigger event rendered
     */
    Component.prototype.rendered = function () {
        this.is_rendered = true;
        this.emitEvent('rendered');
    };

    /**
     * Render component to target
     * Events:
     * - rendered
     * @param {string|jQuery|HTMLElement} target
     * @param {boolean} [is_replace = true] Replace target element by component or replace it's content
     * @returns {Component}
     */
    Component.prototype.render = function (target, is_replace) {
        if (this.is_rendered) {
            this.remove();
        }

        var content = this.compile();

        target = jQuery(target);

        if (_.isUndefined(is_replace) || is_replace) {
            target.replaceWith(content);
        } else {
            target.html(content);
        }

        this.getContainer().data('component', this);
        this.rendered();

        return this;
    };

    /**
     * Handle holder that hold component config
     * This method called after apply options and before render
     * @param {jQuery|DOM} holder component holder
     */
    Component.prototype.handleHolder = function (holder) {
        //
    };

    /**
     * Re-render component
     * Events:
     * - before_re_render
     * - rendered
     * - re-rendered
     * @returns {Component}
     */
    Component.prototype.reRender = function () {
        if (!this.is_rendered) {
            throw new Error('Component is not rendered');
        }

        var html = this.compile();

        this.emitEvent('before_re_render');
        this.is_rendered = false;
        this.getContainer().replaceWith(html).data('component', this);
        this.rendered();
        this.emitEvent('re-rendered');

        return this;
    };

    /**
     * Get component's value
     * @returns {*}
     */
    Component.prototype.getValue = function () {
        if (_.isFunction(this.value_handler)) {
            return this.value_handler(this);
        }

        return null;
    };

    /**
     * Get DOM container of component
     * @param {boolean} [strict_mode = true] If container not found then throw an exception
     * @returns {null|jQuery}
     */
    Component.prototype.getContainer = function (strict_mode) {
        var container = jQuery('#' + this.id);

        if (!container.length) {
            if (strict_mode || _.isUndefined(strict_mode)) {
                throw new Error('Get component DOM failed: #' + this.id + ', name: ' + (this.name || ''));
            }

            return null;
        }

        return container;
    };
    /**
     * Remove component
     * Events:
     * - before_remove
     * - removed
     */
    Component.prototype.remove = function () {
        var dom = this.getContainer();

        if (dom.length) {
            this.emitEvent('before_remove');

            dom.remove();

            this.is_rendered = false;
            this.emitEvent('removed');
        }
    };

    /**
     * Connect component to a store
     * @param {Store} store
     * @return {Component}
     */
    Component.prototype.connectStore = function (store) {
        var storeKey = store.getStoreKey();

        this.stores[storeKey] = store;
        this.emitEvent('connect_store', storeKey, store);

        return this;
    };

    /**
     * Disconnect component from a store
     * @param {Store} store
     * @return {Component}
     */
    Component.prototype.disconnectStore = function (store) {
        var storeKey = store.getStoreKey();

        delete this.stores[storeKey];
        this.emitEvent('disconnect_store', store);

        return this;
    };

    /**
     * Push component data to stores
     * @param {bool} [silent = false] Notice store change or not, default is not notice
     * @return {Component}
     */
    Component.prototype.pushToStores = function (silent) {
        var field = this.store_field || this.name || this.id,
            data = {},
            value;

        if (!field) {
            throw new Error('Store data field is undefined');
        }
        if (!_.isEmpty(this.stores)) {
            value = this.getValue();

            if (_.isFunction(this.store_data_handler)) {
                value = this.store_data_handler(value, this);
            }

            data[field] = value;

            _.each(this.stores, function (store) {
                store[silent ? 'changeSilent' : 'change'](data);
            });
        }
    };

    function init(component) {
        //do nothing
    }

    /**
     * Register component class
     * @param {string} class_name
     * @param {function} constructor
     */
    Component.register = function (class_name, constructor) {
        component_classes[class_name] = constructor;
    };

    /**
     * @param {string} class_name
     * @return {boolean}
     */
    Component.isRegistered = function (class_name) {
        return component_classes.hasOwnProperty(class_name);
    };

    /**
     * @param {string} class_name
     */
    Component.unRegister = function (class_name) {
        delete component_classes[class_name];
    };

    /**
     * @param {string} name
     * @return {boolean}
     */
    Component.isDefined = function (name) {
        return component_defined.hasOwnProperty(name);
    };

    /**
     * @param {string} name
     */
    Component.unDefine = function (name) {
        delete component_defined[name];
    };

    /**
     * Define a component type, base on a component class
     * @param {string} name Component type name
     * @param {{}} detail
     * @param {string} base_on Base component class name
     */
    Component.define = function (name, detail, base_on) {
        if (base_on && !(component_classes.hasOwnProperty(base_on) || component_defined.hasOwnProperty(base_on))) {
            throw new Error('Base class or extend is not defined: ' + base_on);
        }
        if (Component.isRegistered(name)) {
            throw new Error('Component type name is registered by another component class: ' + name);
        }

        component_defined[name] = _.extend({
            base_on: base_on,
            init_handler: null,
            options: {},
            properties: {},
            render_handler: null,
            reset_events: false,
            events: {},
            methods: {},
            value_handler: null
        }, detail);
    };

    /**
     *
     * @param class_name
     * @param name
     * @param options
     * @return {Component}
     */
    Component.factory = function (class_name, name, options) {
        if (!_.isString(name)) {
            throw new Error('Component name is missing or invalid');
        }
        if (component_classes.hasOwnProperty(class_name)) {
            return factory_class(class_name, name, options);
        }
        if (component_defined.hasOwnProperty(class_name)) {
            return factory_defined_class(class_name, name, options);
        }


        throw new Error('Component class not found: ' + class_name);
    };

    function factory_class(class_name, name, options) {
        var constructor = component_classes[class_name],
            comp = new constructor(name);

        comp.name = name;

        if (options) {
            comp.option(options);
        }

        return comp;
    }

    function factory_defined_class(defined_class_name, comp_name, options) {
        var detail = component_defined[defined_class_name],
            comp;

        if (detail.base_on) {
            comp = Component.factory(detail.base_on, comp_name);
        } else {
            comp = new Component(name);
        }

        if (!_.isEmpty(detail.properties) && _.isObject(detail.properties)) {
            _.extend(comp, detail.properties);
        }
        if (detail.hasOwnProperty('options')) {
            comp.option(detail.options);
        }
        if (detail.hasOwnProperty('render_handler') && detail.render_handler) {
            comp.render_handler = detail.render_handler.bind(comp);
        }
        if (detail.hasOwnProperty('detail.value_handler') && detail.value_handler) {
            comp.value_handler = detail.value_handler.bind(comp);
        }

        if (detail.reset_events) {
            if (_.isArray(detail.reset_events)) {
                comp._events = _.omit(comp._events, detail.reset_events);
            } else {
                comp._events = {};
            }
        }
        if (detail.events) {
            _.each(detail.events, function (event_handler, event_name) {
                comp.on(event_name, event_handler);
            });
        }
        if (detail.methods) {
            _.each(detail.methods, function (method, method_name) {
                comp[method_name] = method.bind(comp);
            });
        }
        if (detail.init_handler) {
            detail.init_handler(comp);
        }

        //Apply factory options
        if (options) {
            comp.option(options);
        }

        return comp;
    }

    /**
     * Get list of component class registered
     * @return {Array}
     */
    Component.classes = function () {
        return Object.keys(component_classes);
    };

    /**
     * Get list of component class defined
     * @return {Array}
     */
    Component.defined = function () {
        return Object.keys(component_defined);
    };

    /**
     * Read element and generate components
     * Attributes:
     * - data-comp: Component class name
     * - data-comp-name or data-name or name: Component name. If all of attr is missing, us an auto generate name
     * - data-comp-options: Component options. Object as JSON encoded, or name of a defined object, or a function that return an object
     * - data-comp-op-*: other component option fields. Note that this option fields is override options come from data-comp-options
     * - data-comp-store: Name of variable store to connect
     * - data-comp-init: Name of function use to handle component before render. Function has one argument is component
     * - data-comp-render-replace: render component as replace holder or not
     *
     * @param {string|jQuery} element
     * @return Component|null
     */
    Component.fill = function (element) {
        element = jQuery(element);

        if (!element.length) {
            return null;
        }

        element = element.first();

        var componentDetail = getComponentFromHolder(element);

        componentDetail.component.handleHolder(element);

        return componentDetail.component.render(element, componentDetail.renderReplace);
    };

    Component.fills = function (selector) {
        var holders = jQuery(selector),
            components = [];

        holders.each(function (index, element) {
            components.push(Component.fill(element));
        });

        return components;
    };

    function getComponentFromHolder(element) {
        var el = jQuery(element),
            data = el.data(),
            comp_class,
            comp,
            options = {},
            init,
            store,
            render_replace = true,
            non_option_name = ['comp', 'compName', 'compOptions', 'compStore', 'compInit', 'compRenderReplace'];

        comp_class = data['comp'];

        if (comp_class && !(Component.isRegistered(comp_class) || Component.isDefined(comp_class))) {
            failed_at(el);
            throw new Error('[Component.Fill] Component class is not defined: ' + comp_class);
        }

        var name = data['compName'] || data['name'] || el.attr('name');

        if (!name) {
            name = getID();
        }

        comp = Component.factory(comp_class || 'Component', name);
        el.attr('id', comp.id);

        if (data.hasOwnProperty('compOptions')) {
            if (_.isString(data['compOptions']) && (options = window[data['compOptions']]) && _.isFunction(data['compOptions'])) {
                options = data['compOptions']();
            }
            if (!_.isObject(options)) {
                failed_at(el);
                throw new Error('[Component.Fill] Component options must be an object or function that return an object, #' + comp.id);
            }
        }

        var customOptions = getCustomOptions(comp.options, data, non_option_name);
        _.extend(options, customOptions);

        if (!_.isEmpty(options)) {
            comp.option(options);
        }

        if (store = data['compStore']) {
            store = window[store];

            if (!_.isObject(store)) {
                failed_at(el);
                throw new Error('[Component.Fill] Component store must be an object, #' + comp.id);
            }

            comp.connectStore(store);
        }
        if (init = data['compInit']) {
            init = window[init];

            if (!_.isFunction(init)) {
                failed_at(el);
                throw new Error('[Component.Fill] Component init handler must be an function, #' + comp.id);
            }

            init(comp);
        }

        if (data.hasOwnProperty('compRenderReplace')) {
            render_replace = !_.isEmpty(_.compact([data['compRenderReplace']]))
        }

        return {
            component: comp,
            renderReplace: render_replace
        };
    }

    function failed_at(el) {
        console.warn('[Component.Fill] Failed at', el);
    }

    /**
     * Get custom option in data attr. A custom option data start with 'data-comp-op-'.
     * Note that jQuery parse element's data in camelcase.
     *
     * @param {{}} compOptions Component's options
     * @param {{}} data Data from element's data attribute
     * @param {[]} blackList Black list data name
     * @returns {{}}
     */
    function getCustomOptions(compOptions, data, blackList) {
        blackList = blackList || [];

        var dataNames = _.difference(Object.keys(data), blackList);
        var custom_option_fields = _.filter(dataNames, function (value) {
            return _.startsWith(value, 'compOp');
        });

        if (_.isEmpty(custom_option_fields)) {
            return {};
        }

        var tempOptions = {};

        _.each(custom_option_fields, function (data_name) {
            var data_name_option = data_name.slice(6).trim(),
                data_value = getDataValue(data[data_name]);

            if (data_name_option) {
                tempOptions[data_name_option.toLowerCase()] = data_value;
                tempOptions[_.camelCase(data_name_option)] = data_value;
                tempOptions[_.snakeCase(data_name_option)] = data_value;
            }
        });

        var other_options = _.pick(tempOptions, _.intersection(_.keys(tempOptions), _.keys(compOptions)));

        return !_.isEmpty(other_options) ? other_options : {};
    }

    function getDataValue(value) {
        try {
            var converted = JSON.parse(value);

            return converted;
        } catch (e) {
            //
        }

        return value;
    }

    Component.register('Component', Component);

    /**
     * Connect multiple components to a Store
     * @param {Store} store
     * @param {Component|Component[]} components
     */
    Component.connectStore = function (store, components) {
        components = Array.prototype.slice.call(arguments, 1);

        _.each(components, function (component) {
            component.connectStore(store);
        });
    };

    jQuery.fn.component = function (options) {
        return this.each(function () {
            Component.fill(jQuery(this));
        });
    };

    return Component;
}));