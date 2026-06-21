/**
 * Zod Validation Middleware Factory
 * 
 * Creates Express middleware that validates request data against Zod schemas.
 * Validation errors are passed to the global error handler.
 * 
 * Usage:
 *   import { validate } from '../validators/validate.js';
 *   import { loginSchema } from '../validators/authValidator.js';
 *   
 *   router.post('/login', validate(loginSchema), authController.login);
 */

import { ZodError } from 'zod';

/**
 * Create validation middleware for a Zod schema
 * 
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {String} source - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
export const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            // Parse and validate the request data
            const data = schema.parse(req[source]);

            // Replace request data with validated/transformed data
            // Note: req.query is read-only in Express, so for query params we create a validated copy
            if (source === 'query') {
                req.validatedQuery = data;
            } else {
                req[source] = data;
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                // Let the global error handler format the Zod error
                return next(error);
            }

            // Pass other errors to the error handler
            next(error);
        }
    };
};

/**
 * Validate request body
 * Shorthand for validate(schema, 'body')
 */
export const validateBody = (schema) => validate(schema, 'body');

/**
 * Validate query parameters
 * Shorthand for validate(schema, 'query')
 */
export const validateQuery = (schema) => validate(schema, 'query');

/**
 * Validate route parameters
 * Shorthand for validate(schema, 'params')
 */
export const validateParams = (schema) => validate(schema, 'params');

/**
 * Combine multiple validations (body + params, etc.)
 * 
 * Usage:
 *   router.put('/:id', validateMultiple({
 *     params: idParamSchema,
 *     body: updateUserSchema,
 *   }), controller);
 * 
 * @param {Object} schemas - Object with source keys and schema values
 * @returns {Function} Express middleware function
 */
export const validateMultiple = (schemas) => {
    return async (req, res, next) => {
        try {
            for (const [source, schema] of Object.entries(schemas)) {
                const data = schema.parse(req[source]);
                req[source] = data;
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                return next(error);
            }

            next(error);
        }
    };
};

export default {
    validate,
    validateBody,
    validateQuery,
    validateParams,
    validateMultiple,
};
