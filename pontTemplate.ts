import { CodeGenerator, Interface } from 'pont-engine';

export default class MyGenerator extends CodeGenerator {
  getInterfaceContent(inter: Interface) {
    /* 获取接口实现内容的代码 */
    const paramsCode = inter.getParamsCode();
    const bodyParams = inter.getBodyParamsCode();
    const hasParamsCode = paramsCode && paramsCode.match(/:/g);
    const requestParams = {};
    if (hasParamsCode) {
      requestParams['params'] = 'Params';
    }
    if (bodyParams) {
      requestParams['bodyParams'] = bodyParams;
    }
    // const requestParams = `params:{${
    //   bodyParamsCode ? "bodyParams" : "bodyParams?"
    // }:${bodyParamsCode || "any"},${paramsCode ? "params" : "params?"}: ${
    //   paramsCode ? "Params" : "any"
    // }}`;

    const pathParams = inter.path
      .split('/')
      .filter((part) => part.startsWith('{') && part.endsWith('}'))
      .map((part) => part.slice(1, -1));
    let url = inter.path;
    pathParams.forEach((param) => {
      url = url.replace(`{${param}}`, `\${params.params.${param}}`);
    });

    if (pathParams.length > 0) {
      return `
    /**
     * @description ${inter.description}
     */
    import RequestHelper from '@/utils/BaseRequest'
    import { AxiosRequestConfig } from "axios";

    ${hasParamsCode ? 'export' + ' ' + paramsCode : ' '}
    export async function request(params:${JSON.stringify(requestParams).replace(
      /"/g,
      ''
    )},axiosConfig?: AxiosRequestConfig):Promise<${inter.responseType}> {
        return RequestHelper.request({
            url: \`${url}\`,
            method: '${inter.method}',
            params: {},
        },axiosConfig)
    };
        `;
    } else {
      return `
    /**
     * @description ${inter.description}
     */
    import RequestHelper from '@/utils/BaseRequest'
    import { AxiosRequestConfig } from "axios";

    ${hasParamsCode ? 'export' + ' ' + paramsCode : ' '}
    export async function request(params:${JSON.stringify(requestParams).replace(
      /"/g,
      ''
    )},axiosConfig?: AxiosRequestConfig):Promise<${inter.responseType}> {
        return RequestHelper.request({
            url: \`${url}\`,
            method: '${inter.method}',
            params: params,
        },axiosConfig)
    };
        `;
    }
  }

  getInterfaceContentInDeclaration(inter: Interface) {
    /* 获取接口内容的类型定义代码 */
    const paramsCode = inter.getParamsCode();
    const bodyParams = inter.getBodyParamsCode();
    const requestParams = {};
    const hasParamsCode = paramsCode && paramsCode.match(/:/g);
    if (hasParamsCode) {
      requestParams['params'] = 'Params';
    }
    if (bodyParams) {
      requestParams['bodyParams'] = bodyParams;
    }
    JSON.stringify(requestParams).replace(/"/g, '');
    // const requestParams = `params: {
    //   ${bodyParams ? "bodyParams" : "bodyParams?"}: ${bodyParams || "any"};
    //   ${paramsCode ? "params" : "params?"}: ${paramsCode ? "Params" : "any"}}
    // `;

    return `
    ${hasParamsCode ? 'export ' + paramsCode : ''}
        export function request(params:${JSON.stringify(requestParams).replace(
          /"/g,
          ''
        )},axiosConfig?: AxiosRequestConfig): Promise<${inter.responseType}>
        `;
  }

  getDeclaration() {
    return `
  type AxiosRequestConfig = any;
  type ObjectMap<Key extends string | number | symbol = any, Value = any> = {
    [key in Key]: Value;
  }

  ${this.getCommonDeclaration()}

  ${this.getBaseClassesInDeclaration()}

  ${this.getModsDeclaration()}
`;
  }
}
