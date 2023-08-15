// Универсальная функция наследования
Function.prototype.inherits = function (superClass) {
  var Inheritance = function () { };
  Inheritance.prototype = superClass.prototype;
  this.prototype = new Inheritance();
  this.prototype.constructor = this;
  this.superClass = superClass;
  // доступ к родительскому классу из инстанса
  this.prototype.superClass = superClass.prototype;
  return this;
}

// переопределение свойств/методов
Function.prototype.override = function (proto) {
  for (var k in proto)
    this.prototype[k] = proto[k];
  return this;
}

// статические свойства/методы
Function.prototype.statics = function (proto) {
  for (var k in proto)
    this[k] = proto[k];
  return this;
}