export interface IService<T> {
  execute(data: any): Promise<T>;
}
