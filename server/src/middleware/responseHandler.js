// middleware/responseHandler.js (NEW FILE)
export const sendSuccess = (res, data, meta = null, status = 200) => {
    return res.status(status).json({
        success: true,
        data,
        error: null,
        meta,
    });
};

export const sendError = (res, status, message, meta = null) => {
    return res.status(status).json({
        success: false,
        data: null,
        error: message,
        meta,
    });
};

export const sendPaginated = (res, data, pagination) => {
    return res.status(200).json({
        success: true,
        data,
        error: null,
        meta: {
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total: pagination.total,
                pages: pagination.pages,
                hasNextPage: pagination.hasNextPage,
                hasPrevPage: pagination.hasPrevPage,
            },
        },
    });
};