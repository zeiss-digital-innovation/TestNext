import {Provider, ReflectiveInjector} from "@angular/core";

import {ISpecContainer} from './iSpec-Container';
import {ISpecMethodContainer} from "./specMethodContainer/iSpec-method-Container";
import {SpecMethodContainer} from "./specMethodContainer/spec-method-container";
import {SpecMethodType} from "./specMethodContainer/spec-method-type";

import {SpecRegistryError} from "../spec-registry-error";
import * as _ from "underscore";


export class SpecContainer implements ISpecContainer{

  private specClassConstructor: any;
  private specDescription: string;
  private subjects = new Array<string>();
  private ignored: boolean = false;
  private ignoreReason: string = '';

  private parent: ISpecContainer;
  private sut:Provider;
  private providers =  new Array<Provider>();

  private given = new Map<number, SpecMethodContainer>(); // exec-Number, MethodName
  private when: SpecMethodContainer;
  private then = new Map<number, SpecMethodContainer>();
  private thenThrow: SpecMethodContainer;

  constructor(specClassConstructor: Function, parentSpec?:ISpecContainer) {
    if(this.specClassConstructor)
      throw new Error ('Cannot instantiate SpecContainer with specClassConstructor = null');
    this.specClassConstructor = specClassConstructor;
    this.parent = parentSpec;
  }

  setDescription(specName: string) {
    this.specDescription = specName
  }

  setSUT(sut:Provider){
    if(this.sut != null)
      throw new SpecRegistryError('Multiple @SUT on SpecWithSUT "' + this.getClassName() + '", only one is possible', this.getClassName());

    if(!this.providers.includes(sut))
      this.providers.push(sut);

    this.sut = sut;


  }

  addSubject(subject:string){
    if(!this.subjects.includes(subject))
      this.subjects.push(subject);
  }

  addProviders(newProviders: Array<Provider>) {
    this.providers = _.union(newProviders, this.providers);

  }

  setIgnored(reason:string){
    this.ignored = true;
    this.ignoreReason = reason;
  }


  addGiven(functionName: string, description: string, execNumber?: number) {
    if(this.getOwnMethod(functionName) != null)
      throw new SpecRegistryError('Multiple Methods with same Name on ' + this.getClassName() + '.' + functionName, this.getClassName(), functionName);
    if (execNumber == null) execNumber = 0;
    if (this.given == null) this.given = new Map<number, SpecMethodContainer>();
    if (this.given.get(execNumber) != null)
      throw new SpecRegistryError('Multiple @given, without ExecNumber, or it (' + execNumber + ') already exists on ' + this.getClassName() + '.' + functionName, this.getClassName(), functionName);
    this.given.set(execNumber, new SpecMethodContainer(functionName, description, SpecMethodType.GIVEN, execNumber));
  }

  addWhen(functionName: string, description: string) {
    if (this.when != null)
      throw new SpecRegistryError('Only one @When allowed on ' + this.getClassName() + ' cannot add ' + functionName + ', ' + this.when.getName() + ' is already @When', this.getClassName(), functionName);
    if(this.getOwnMethod(functionName) != null)
      throw new SpecRegistryError('Multiple Methods with same Name on ' + this.getClassName() + '.' + functionName, this.getClassName(), functionName);
    this.when = new SpecMethodContainer(functionName, description, SpecMethodType.WHEN);
  }

  addThen(functionName: string, description: string, execNumber: number) {
    if(this.getOwnMethod(functionName) != null)
      throw new SpecRegistryError('Multiple Methods with same Name on ' + this.getClassName() + '.' + functionName, this.getClassName(), functionName);
    if (execNumber == null) execNumber = 0;
    if (this.then == null) this.then = new Map<number, SpecMethodContainer>();
    if (this.then.get(execNumber) != null)
      throw new SpecRegistryError('Multiple @then, without ExecNumber, or it (' + execNumber + ') already exists on ' + this.getClassName() + '.' + functionName, this.getClassName(), functionName);
    this.then.set(execNumber, new SpecMethodContainer(functionName, description, SpecMethodType.THEN, execNumber));
  }

  addThenError(functionName: string, description: string){
    if(this.thenThrow != null)
      throw new SpecRegistryError(
        'Only one @ThenThrow allowed on ' + this.getClassName() + ' cannot add ' + functionName +
        ', ' + this.thenThrow.getName() + ' is already @ThenThrow', this.getClassName(),
        functionName
      );
    if(this.getOwnMethod(functionName) != null)
      throw new SpecRegistryError(
        'Multiple Methods with same Name on ' + this.getClassName() + '.' + functionName, this.getClassName(),
        functionName
      );
    this.thenThrow = new SpecMethodContainer(functionName, description, SpecMethodType.THEN_ERROR);
  }


  getDescription():string{
    if(this.specDescription == null)
      return '';
    return this.specDescription;
  }

  getSubjects():Array<string>{
    return this.subjects;
  }

  getSpecName():string {
    return this.specDescription;
  }

  getIgnoreReason():string{
    return this.ignoreReason;
  }

  getParentSpec(): ISpecContainer{
    return this.parent;
  }

  getClassName():string {

    return this.specClassConstructor.name;
  }

  getClassConstructor():Function {
    return this.specClassConstructor;
  }

  getNewSpecObject(): any{
    if(this.specClassConstructor == null)
      throw new SpecRegistryError('Class of ' + this.getClassName() + 'is not set', this.getClassName());
    if(this.specClassConstructor.length > 0)
      throw new SpecRegistryError('Class of "' + this.getClassName() + '" has constructor-arguments, this is forbidden', this.getClassName());

    let object =  new this.specClassConstructor;

    try {
      let sut = this.getSUT();
      if (sut != null) {
        let injector = ReflectiveInjector.resolveAndCreate(this.getProviders());
        object['SUT'] = injector.get(sut);
      }
    } catch(error){
      throw new SpecRegistryError(error.message, this.getClassName());
    }



    return object;
  };

  isIgnored():boolean{
    return this.ignored;
  }

  getSUT():Provider {
    if(this.sut != null)
      return this.sut;
    else if(this.parent != null)
      return this.parent.getSUT();
    else
      return null;

  }

  getProviders():Array<Provider>{
    let providers = this.providers;

    if(this.parent != null) {
      providers = _.union(providers, this.parent.getProviders());
    }


    return providers;
  }


  getGiven():Array<ISpecMethodContainer>{
    let returnMethods = new Array<ISpecMethodContainer>();

    if(this.parent != null) {
      returnMethods = returnMethods.concat(this.parent.getGiven());
    }
    returnMethods = returnMethods.concat(this.getOwnGiven());
    return returnMethods;
  }

  getWhen():ISpecMethodContainer{
    if(this.when != null)
      return this.when;
    if(this.parent != null)
      return this.parent.getWhen();
  }

  getThen():Array<ISpecMethodContainer>{
    let returnMethods = new Array<ISpecMethodContainer>();
    if(this.parent != null)
      returnMethods = returnMethods.concat(this.parent.getThen());
    returnMethods = returnMethods.concat(this.getOwnThen());

    return returnMethods;
  }

  getThenThrow():ISpecMethodContainer{
    if(this.thenThrow != null)
      return this.thenThrow;
    if(this.parent != null)
      return this.parent.getThenThrow();
  }


  isExecutableSpec():boolean{
    if(this.specDescription == null)
      return false;
    return true;
  }

  isExpectingErrors():boolean{
    if(this.thenThrow != null)
      return true;
    return false;
  }


  private getOwnGivenByName(methodName:string): ISpecMethodContainer{
    let returnMethod = null;
    this.given.forEach((method) => {
      if(method.getName() == methodName) {
        returnMethod = method;
        return;
      }
    });
    return returnMethod;
  }

  private getOwnThenByName(methodName:string): ISpecMethodContainer{
    let returnMethod = null;
    this.then.forEach((method) => {
      if(method.getName() == methodName) {
        returnMethod = method;
        return;
      }
    });

    return returnMethod;
  }

  private getOwnGiven(): Array<ISpecMethodContainer> {
    let keys = Array.from(this.given.keys()).sort();

    let returnArray = new Array<SpecMethodContainer>();
    keys.forEach((key) => {
      returnArray.push(this.given.get(key));
    });
    return returnArray;
  }

  private getOwnWhen(): ISpecMethodContainer {
    return this.when;
  }

  private getOwnThen(): Array<ISpecMethodContainer> {
    let keys = Array.from(this.then.keys()).sort();

    let returnArray = new Array<SpecMethodContainer>();
    keys.forEach((key) => {
      returnArray.push(this.then.get(key));
    });
    return returnArray;
  }

  private getOwnThenThrow():ISpecMethodContainer{
    return this.thenThrow;
  }


  private getOwnMethods():Array<ISpecMethodContainer>{
    let methods = new Array<ISpecMethodContainer>();
    methods = methods.concat(this.getOwnGiven());
    methods.push(this.getOwnWhen());
    methods = methods.concat(this.getOwnThen());
    methods = methods.concat(this.getOwnThenThrow());
    return methods;
  }

  private getOwnMethod(methodName: string):ISpecMethodContainer{
    let method;

    if(this.when != null && this.when.getName() == methodName)
      return this.when;

    if(this.thenThrow != null && this.thenThrow.getName() == methodName)
      return this.thenThrow;

    method = this.getOwnGivenByName(methodName);
    if(method != null )
      return method;

    method = this.getOwnThenByName(methodName);
    return method;
  }



}



