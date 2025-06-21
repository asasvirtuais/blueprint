export default function blueprint(optionsOrImplementation) {
    let parsedOptions;
    if (typeof optionsOrImplementation === 'function') {
        parsedOptions = { initialImplementation: optionsOrImplementation };
    }
    else {
        parsedOptions = optionsOrImplementation;
    }
    const initialState = {
        key: parsedOptions?.key,
        description: parsedOptions?.description,
        implementation: parsedOptions?.initialImplementation,
        inputMappers: [],
        outputMappers: [],
        beforeHooks: [],
        afterHooks: [],
        defaultProviders: [],
        enforcedValues: {},
        isAsync: false,
        isVoid: false,
        propsSchema: undefined,
        validateProps: false, // Default to false
        resultSchema: undefined,
        validateResults: false, // Default to false
    };
    function makeCallable(currentState) {
        const callableBlueprint = (props) => {
            let currentProps = typeof props === 'object' && props !== null ? { ...props } : props;
            if (props === undefined && Object.keys(currentState.defaultProviders).length > 0) {
                currentProps = {};
            }
            // 1. Apply defaults
            let resolvedDefaults = {};
            for (const provider of currentState.defaultProviders) {
                const defaults = typeof provider === 'function' ? provider(currentProps) : provider;
                resolvedDefaults = { ...resolvedDefaults, ...defaults };
            }
            currentProps = { ...resolvedDefaults, ...(typeof props === 'object' && props !== null ? props : (props === undefined ? {} : { props })) };
            if (typeof currentProps !== 'object' && Object.keys(currentState.enforcedValues).length === 0 && currentState.inputMappers.length === 0 && !currentState.implementation) {
                // Primitive props scenario
            }
            else if (typeof currentProps !== 'object' && currentProps !== null && currentProps !== undefined) {
                // Primitive prop with defaults/enforcements
            }
            else {
                currentProps = { ...resolvedDefaults, ...(currentProps || {}) };
            }
            // 2. Apply enforced values
            currentProps = { ...currentProps, ...currentState.enforcedValues };
            // 3. Input mappers
            let mappedProps = currentProps;
            for (const mapper of currentState.inputMappers) {
                mappedProps = mapper(mappedProps);
            }
            // 3.5 Props validation
            let validatedProps = mappedProps;
            if (currentState.validateProps && currentState.propsSchema) {
                try {
                    validatedProps = currentState.propsSchema.parse(mappedProps);
                }
                catch (e) {
                    console.error("Blueprint props validation error. State:", currentState, "Props:", mappedProps);
                    // Re-throw ZodError or other errors
                    throw e;
                }
            }
            // 4. Before hooks (operate on validated props)
            currentState.beforeHooks.forEach(hook => hook(validatedProps));
            // 5. Core implementation (with validated props)
            if (!currentState.implementation) {
                const id = currentState.key ? `'${String(currentState.key)}' ` : '';
                throw new Error(`Blueprint ${id}has not been implemented.`);
            }
            let result = currentState.implementation(validatedProps);
            // 6. Async handling for the core result
            if (currentState.isAsync && !(result && typeof result.then === 'function')) {
                result = Promise.resolve(result);
            }
            const processResultAndFinalize = (resolvedResult) => {
                let currentResult = resolvedResult;
                // 7. Output mappers (pass validated props)
                for (const mapper of currentState.outputMappers) {
                    currentResult = mapper(currentResult, validatedProps);
                }
                // 7.5 Result validation
                let validatedResult = currentResult;
                if (currentState.validateResults && currentState.resultSchema) {
                    try {
                        validatedResult = currentState.resultSchema.parse(currentResult);
                    }
                    catch (e) {
                        console.error("Blueprint result validation error. State:", currentState, "Result:", currentResult);
                        throw e;
                    }
                }
                // 8. After hooks (pass validated result and validated props)
                currentState.afterHooks.forEach(hook => hook(validatedResult, validatedProps));
                // 9. Void handling
                if (currentState.isVoid) {
                    return undefined;
                }
                return validatedResult;
            };
            if (result && typeof result.then === 'function') { // Is a Promise
                return result.then(processResultAndFinalize);
            }
            else {
                return processResultAndFinalize(result);
            }
        };
        Object.defineProperty(callableBlueprint, 'key', { value: currentState.key, writable: false, enumerable: true });
        Object.defineProperty(callableBlueprint, 'description', { value: currentState.description, writable: false, enumerable: true });
        Object.defineProperty(callableBlueprint, '__isBlueprint', { value: true, writable: false, enumerable: false });
        callableBlueprint.implement = (newImpl) => {
            return makeCallable({ ...currentState, implementation: newImpl });
        };
        callableBlueprint.mod = (modFn) => {
            return modFn(callableBlueprint);
        };
        callableBlueprint.more = (modFn) => {
            return modFn(callableBlueprint);
        };
        callableBlueprint.input = (transform) => {
            return makeCallable({ ...currentState, inputMappers: [transform, ...currentState.inputMappers] });
        };
        callableBlueprint.defaults = (defaultsOrProvider) => {
            const provider = typeof defaultsOrProvider === 'function' ? defaultsOrProvider : () => defaultsOrProvider;
            return makeCallable({ ...currentState, defaultProviders: [...currentState.defaultProviders, provider] });
        };
        callableBlueprint.enforce = (enforced) => {
            return makeCallable({ ...currentState, enforcedValues: { ...currentState.enforcedValues, ...enforced } });
        };
        callableBlueprint.output = (transform) => {
            return makeCallable({ ...currentState, outputMappers: [...currentState.outputMappers, transform] });
        };
        callableBlueprint.before = (effect) => {
            return makeCallable({ ...currentState, beforeHooks: [...currentState.beforeHooks, effect] });
        };
        callableBlueprint.after = (effect) => {
            return makeCallable({ ...currentState, afterHooks: [...currentState.afterHooks, effect] });
        };
        callableBlueprint.toAsync = () => {
            return makeCallable({ ...currentState, isAsync: true });
        };
        callableBlueprint.toVoid = () => {
            return makeCallable({ ...currentState, isVoid: true });
        };
        callableBlueprint.zProps = (schema) => {
            return makeCallable({ ...currentState, propsSchema: schema, validateProps: true });
        };
        callableBlueprint.zResult = (schema) => {
            return makeCallable({ ...currentState, resultSchema: schema, validateResults: true });
        };
        callableBlueprint.pipe = (nextBlueprintOrFn) => {
            const newImplementation = (initialProps) => {
                const currentBlueprintResult = callableBlueprint(initialProps);
                const executeNext = (resolvedCurrentResult) => {
                    if (typeof nextBlueprintOrFn === 'function' && nextBlueprintOrFn.__isBlueprint) {
                        return nextBlueprintOrFn(resolvedCurrentResult);
                    }
                    return nextBlueprintOrFn(resolvedCurrentResult);
                };
                if (currentBlueprintResult && typeof currentBlueprintResult.then === 'function') {
                    return currentBlueprintResult.then(executeNext);
                }
                else {
                    return executeNext(currentBlueprintResult);
                }
            };
            let pipedIsAsync = currentState.isAsync; // Simplistic async propagation
            let pipedIsVoid = currentState.isVoid; // Simplistic void propagation; determined by final stage.
            return makeCallable({
                key: currentState.key ? `${String(currentState.key)} |> piped` : undefined,
                description: currentState.description ? `${currentState.description}, then piped` : undefined,
                implementation: newImplementation,
                inputMappers: [],
                outputMappers: [],
                beforeHooks: [],
                afterHooks: [],
                defaultProviders: [],
                enforcedValues: {},
                isAsync: pipedIsAsync,
                isVoid: pipedIsVoid,
                propsSchema: undefined, // Piped blueprint starts fresh for validation unless explicitly set
                resultSchema: undefined,
                validateProps: false, // Reset for piped blueprint
                validateResults: false, // Reset for piped blueprint
            });
        };
        return callableBlueprint;
    }
    return makeCallable(initialState);
}
/**
 * Cria um Blueprint a partir de uma função normal, mapeando parâmetros posicionais para um objeto
 * @template F O tipo da função original
 * @template K Array de strings para as chaves dos parâmetros
 * @param fn A função original que aceita parâmetros posicionais
 * @param keys Array de strings que serão as chaves do objeto de entrada do Blueprint
 * @returns Um Blueprint que aceita um objeto com as chaves especificadas
 */
export function from(fn, keys) {
    return blueprint().implement((props) => {
        const args = keys.map(key => props[key]);
        return fn(...args);
    });
}
// Adicione como método estático
blueprint.from = from;
//# sourceMappingURL=index.js.map