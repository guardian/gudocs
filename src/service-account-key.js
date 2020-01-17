import { getSSMClient } from './aws-utils'

const parameterStore = getSSMClient();
const stage = process.env.NODE_ENV || 'dev'

export default {

    async getServiceAccountKey() {

        const paramName = `/${stage}/gudocs/google.credentials`

        const getParamRequest = {Name: paramName, WithDecryption: true};

        const paramtereBlob = (await (parameterStore.getParameter(getParamRequest).promise())).Parameter.Value;

        return JSON.parse(paramtereBlob);
    }

}

