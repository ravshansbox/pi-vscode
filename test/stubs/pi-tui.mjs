export class Text {
  constructor(text, paddingX = 1, paddingY = 1) {
    this.text = text;
    this.paddingX = paddingX;
    this.paddingY = paddingY;
  }

  render() {
    const pad = " ".repeat(this.paddingX);
    return this.text.split("\n").map((line) => pad + line);
  }
}
