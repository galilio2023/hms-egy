declare module 'tafgeetjs' {
  export default class Tafgeet {
    constructor(amount: number, currency?: string);
    parse(): string;
  }
}
