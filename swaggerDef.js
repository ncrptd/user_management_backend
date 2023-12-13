/**
 * @swagger
 * definitions:
 *   YourModel:
 *     properties:
 *       propertyName:
 *         type: string
 */

/**
 * @swagger
 * /api/endpoint:
 *   get:
 *     summary: Description of the endpoint
 *     tags:
 *       - Your Tag
 *     parameters:
 *       - name: parameterName
 *         description: Description of the parameter
 *         in: query
 *         required: true
 *         type: string
 *     responses:
 *       '200':
 *         description: Successful response
 *         schema:
 *           $ref: '#/definitions/YourModel'
 */
