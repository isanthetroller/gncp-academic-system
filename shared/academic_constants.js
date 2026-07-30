// Shared Academic Constants for GNCP
(function (global) {
    const DEPARTMENTS = [
        { code: 'COIT', name: 'Information Technology', dbName: 'Information Technology' },
        { code: 'COBA', name: 'Business Administration', dbName: 'Business Administration' },
        { code: 'COHS', name: 'College of Nursing', dbName: 'College of Nursing' }
    ];

    global.GNCP_DEPARTMENTS = DEPARTMENTS;
})(typeof window !== 'undefined' ? window : global);
