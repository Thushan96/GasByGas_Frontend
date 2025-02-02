import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RegisterModel } from '../../model/register.model';
import { LoginService } from '../../service/login.service';
import { LoginHeaderComponent } from "../login-header/login-header.component";

interface BackendUserModel {
  name: string;
  contactNo: number;
  email: string;
  password: string;
  roles: string[];
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, FormsModule, HttpClientModule, LoginHeaderComponent]
})
export class RegisterComponent {
  registerForm: FormGroup;
  user: RegisterModel = {
    userId: '',
    email: '',
    mobileNumber: '',
    name: '',
    password: '',
    termsConditions: false,
    role: ''
  };
  roles: string[] = ['ADMIN', 'USER', 'MODERATOR'];
  isSubmitting = false;
  errorMessage = '';

  constructor(
    private formBuilder: FormBuilder,
    private loginService: LoginService,
    private router: Router
  ) {
    this.registerForm = this.formBuilder.group({
      userId: [''],
      email: ['', [Validators.required, Validators.email]],
      mobileNumber: [''],
      name: [''],
      password: [''],
      termsConditions: [false, Validators.requiredTrue],
      role: ['']
    });
  }

  get f() {
    return this.registerForm.controls;
  }

  getErrorMessage(controlName: string): string {
    const control = this.registerForm.get(controlName);
    if (control?.errors) {
      if (control.errors['required']) {
        return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} is required`;
      }
      if (control.errors['minlength']) {
        return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} must be at least ${control.errors['minlength'].requiredLength} characters`;
      }
      if (control.errors['pattern']) {
        if (controlName === 'mobileNumber') {
          return 'Please enter a valid 10-digit mobile number';
        }
        if (controlName === 'password') {
          return 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character';
        }
      }
    }
    return '';
  }

  onSubmit() {
    if (this.registerForm.invalid || this.isSubmitting) {
      Object.keys(this.registerForm.controls).forEach(key => {
        const control = this.registerForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const backendUser: BackendUserModel = {
      name: this.registerForm.value.name,
      contactNo: parseInt(this.registerForm.value.mobileNumber),
      email: this.registerForm.value.email,
      password: this.registerForm.value.password,
      roles: [`ROLE_${this.registerForm.value.role.toUpperCase()}`]
    };

    this.loginService.createUser(backendUser).subscribe({
      next: (response) => {
        console.log('Registration successful', response);

        // After successful registration, fetch user details by email
        this.loginService.searchByEmail(backendUser.email).subscribe({
          next: (userDetails) => {
            localStorage.setItem('userDetails', JSON.stringify(userDetails));
            console.log('User details saved after registration:', userDetails);
            this.router.navigate(['/login']);
          },
          error: (error) => {
            console.error('Error fetching user details:', error);
            // Still navigate even if fetching additional details fails
            this.router.navigate(['/login']);
          }
        });
      },
      error: (error) => {
        console.error('Registration failed', error);
        this.errorMessage = error.message || 'Registration failed. Please try again.';
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      }
    });
  }
}
