import { Directive, Input } from "@angular/core";
import {
  AsyncValidator,
  AbstractControl,
  NG_ASYNC_VALIDATORS
} from "@angular/forms";
import { Http, RequestOptions, Response, Headers } from "@angular/http";
import { Observable } from "rxjs/Observable";
import { Subject } from "rxjs/Subject";

@Directive({
  selector:
    "[appRemoteValidator][formControlName],[appRemoteValidator][formControl],[appRemoteValidator][ngModel]",
  providers: [
    {
      provide: NG_ASYNC_VALIDATORS,
      useExisting: RemoteValidatorDirective,
      multi: true
    }
  ]
})
export class RemoteValidatorDirective implements AsyncValidator {
  @Input("remote-url") remoteUrl: string;
  @Input("remote-field") remoteField: string;
  @Input("remote-additional-fields") remoteAdditionalFields: string;

  constructor(private http: Http) {}

  validate(control: AbstractControl): Observable<{ [key: string]: any }> {
    if (!this.remoteUrl || this.remoteUrl === undefined) {
      return Observable.throw("`remoteUrl` is undefined.");
    }

    if (!this.remoteField || this.remoteField === undefined) {
      return Observable.throw("`remoteField` is undefined.");
    }

    const dataObject = {};
    if (
      this.remoteAdditionalFields &&
      this.remoteAdditionalFields !== undefined
    ) {
      const otherFields = this.remoteAdditionalFields.split(",");
      otherFields.forEach(field => {
        const name = field.trim();
        const otherControl = control.root.get(name);
        if (otherControl) {
          dataObject[name] = otherControl.value;
        }
      });
    }

    // This is used to signal the streams to terminate.
    const changed$ = new Subject<any>();
    changed$.next(); // This will signal the previous stream (if any) to terminate.

    const debounceTime = 400;

    return new Observable((obs: any) => {
      control.valueChanges
        .takeUntil(changed$)
        .take(1)
        .debounceTime(debounceTime)
        .distinctUntilChanged()
        .flatMap(term => {
          dataObject[this.remoteField] = term;
          return this.doRemoteValidation(dataObject);
        })
        .subscribe(
          (result: IRemoteValidationResult) => {
            if (result.result) {
              obs.next(null);
            } else {
              obs.next({
                remoteValidation: {
                  remoteValidationMessage: result.message
                }
              });
            }

            obs.complete();
          },
          error => {
            obs.next(null);
            obs.complete();
          }
        );
    });
  }

  private doRemoteValidation(data: any): Observable<IRemoteValidationResult> {
    const headers = new Headers({ "Content-Type": "application/json" }); // for ASP.NET MVC
    const options = new RequestOptions({ headers: headers });

    return this.http
      .post(this.remoteUrl, JSON.stringify(data), options)
      .map(this.extractData)
      .do(result => console.log("remoteValidation result: ", result))
      .catch(this.handleError);
  }

  private extractData(res: Response): IRemoteValidationResult {
    const body = <IRemoteValidationResult>res.json();
    return body || (<IRemoteValidationResult>{});
  }

  private handleError(error: Response): Observable<any> {
    console.error("observable error: ", error);
    return Observable.throw(error.statusText);
  }
}

export interface IRemoteValidationResult {
  result: boolean;
  message: string;
}
