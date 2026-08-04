// Shared Academic Constants for GNCP
(function (global) {
    const DEPARTMENTS = [
        { code: 'COIT', name: 'Information Technology', dbName: 'Information Technology' },
        { code: 'COBA', name: 'Business Administration', dbName: 'Business Administration' },
        { code: 'COHS', name: 'College of Nursing', dbName: 'College of Nursing' }
    ];

    const STATION_ROLES = {
        REGISTRAR:   { key: 'REGISTRAR',   title: 'Registrar Document Verification', path: '/systemtest/registrar/' },
        HELPDESK:    { key: 'HELPDESK',    title: 'Academic Advising & Sectioning', path: '/systemtest/stations/tlc-helpdesk/' },
        MEDICAL:     { key: 'MEDICAL',     title: 'Clinic Medical Examination',     path: '/systemtest/stations/medical-checkup/' },
        CASHIER:     { key: 'CASHIER',     title: 'Cashier Payment Processing',    path: '/systemtest/stations/payment-processing/' },
        IT_CENTER:   { key: 'IT_CENTER',   title: 'IT Center Account Promotion',    path: '/systemtest/stations/it-center/' }
    };

    const PIPELINE_STAGES = [
        { id: 1, key: 'PRE_REGISTERED', label: 'Online Pre-Reg' },
        { id: 2, key: 'VERIFIED',       label: 'Registrar Verification' },
        { id: 3, key: 'ADVISED',        label: 'Academic Advising' },
        { id: 4, key: 'MEDICAL_CLEARED',label: 'Medical Clearance' },
        { id: 5, key: 'PAID',           label: 'Cashier Payment' },
        { id: 6, key: 'ENROLLED',       label: 'IT Center ID & Account' }
    ];

    global.GNCP_DEPARTMENTS    = DEPARTMENTS;
    global.GNCP_STATION_ROLES  = STATION_ROLES;
    global.GNCP_PIPELINE_STAGES = PIPELINE_STAGES;
})(typeof window !== 'undefined' ? window : global);
