import { StandardDataSource } from 'pont-engine';

export default function (dataSource: StandardDataSource): StandardDataSource {
  dataSource.baseClasses.forEach((baseClass) => {
    if (baseClass.properties && baseClass.properties.length) {
      baseClass.properties.forEach((properti) => {
        properti.name = properti.name;
      });
    }
  });
  dataSource.mods.forEach((item) => {
    item.name = item.name + 'Api';
    return item;
  });
  return dataSource;
}
