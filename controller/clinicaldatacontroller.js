import * as storageHelper from "./helper/storagehelper.js";
import { rights } from "./helper/authorizationhelper.js";

// Must match the fileNameSeparator defined in the webapp (defined in the webapp since it must work offline as well)
const fileNameSeparator = "__";

// Must match the fileNameSeparator defined in the webapp (defined in the webapp since it must work offline as well)
const dataStatusTypes = {
    EMPTY: 1,
    INCOMPLETE: 2,
    COMPLETE: 3,
    VALIDATED: 4,
    CONFLICT: 5
};

export const getSubjects = context => {
   return context.json(storageHelper.getClinicaldataFileNames(), 200);
}

export const getClinicaldata = async (context, user) => {
    const fileName = context.params.fileName.replaceAll("%20", " ");

    if (user.site && user.site != getSubjectSiteFromFileName(fileName)) {
        return context.string("You are not allowed to get clinical data from a subject that is assigned to another site than you.", 403);
    }

    const clinicaldata = storageHelper.getClinicaldata(fileName);
    return context.string(clinicaldata, 200);
};

export const setClinicaldata = async (context, user) => {
    const fileName = context.params.fileName.replaceAll("%20", " ");

    if (user.site && user.site != getSubjectSiteFromFileName(fileName)) {
        return context.string("You are not allowed to set clinical data for a subject that is assigned to another site than you.", 403);
    }

    // Users without the validate form right may not update a subject with a validated status
    const subjectKey = getSubjectKeyFromFileName(fileName);
    const existingSubject = storageHelper.getClinicaldataFileNames().find(clinicaldataFileName => subjectKey == getSubjectKeyFromFileName(clinicaldataFileName));
    if (getSubjectStatusFromFileName(existingSubject) == dataStatusTypes.VALIDATED && !user.hasAuthorizationFor(rights.VALIDATEFORMS)) return context.string("Not authorized to change data for a validated subject.", 403);

    const clinicaldata = await context.body;
    storageHelper.storeClinicaldata(fileName, clinicaldata);
    return context.string("Clinicaldata successfully stored.", 201);
};

export const deleteClinicaldata = async (context, user) => {
    const fileName = context.params.fileName.replaceAll("%20", " ");

    // Users with the ADDSUBJECTDATA right might archive an expired clinical subject data version
    // However, they need the MANAGESUBJECTS right to archive the last available version as well
    const subjectKey = getSubjectKeyFromFileName(fileName);
    let occurrences = 0;
    for (const clinicaldataFileName of storageHelper.getClinicaldataFileNames()) {
        if (subjectKey == getSubjectKeyFromFileName(clinicaldataFileName)) occurrences++;
        if (occurrences > 1) break;
    }
    if (occurrences == 1 && !user.hasAuthorizationFor(rights.MANAGESUBJECTS)) return context.string("Not authorized to remove clinical data.", 403);

    // Users without the validate form right may not delete a subject with a validated status
    if (getSubjectStatusFromFileName(fileName) == dataStatusTypes.VALIDATED && !user.hasAuthorizationFor(rights.VALIDATEFORMS)) return context.string("Not authorized to remove a validated subject.", 403);

    storageHelper.removeClinicaldata(fileName);
    return context.string("Clinicaldata successfully deleted.", 200);
};

function getSubjectKeyFromFileName(fileName) {
    const fileNameParts = fileName.split(fileNameSeparator);
    return fileNameParts[0];
}

function getSubjectSiteFromFileName(fileName) {
    const fileNameParts = fileName.split(fileNameSeparator);
    return fileNameParts[1] || null;
}

function getSubjectStatusFromFileName(fileName) {
    const fileNameParts = fileName.split(fileNameSeparator);
    return fileNameParts[4] || null;
}
