export class AppendString {
  constructor(separator) {
    this.last = ''
    this.separator = separator
  }
  add(str) {
    if (this.last == '') {
      this.last = str
    } else {
      this.last = this.last + this.separator + str
    }
  }
  string() {
    return this.last
  }
}