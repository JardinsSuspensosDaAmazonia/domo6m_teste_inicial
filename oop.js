// Universal inheritance function
Function.prototype.inherits = function (superClass) {
  var Inheritance = function () { };
  Inheritance.prototype = superClass.prototype;
  this.prototype = new Inheritance();
  this.prototype.constructor = this;
  this.superClass = superClass;
  // accessing parent class from instance
  this.prototype.superClass = superClass.prototype;
  return this;
}

// overriding properties/methods
Function.prototype.override = function (proto) {
  for (var k in proto)
    this.prototype[k] = proto[k];
  return this;
}

// static properties/methods
Function.prototype.statics = function (proto) {
  for (var k in proto)
    this[k] = proto[k];
  return this;
}