import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

import jsPDF from 'jspdf';
import { Router } from '@angular/router';
import { OrderSummaryDTO } from '../../../model/order-summary.model';
import { LoginService } from '../../../service/login.service';
import { PaypalService } from '../../../service/paypal.service';
import { OrderService } from '../../../service/order.service';
import Swal from 'sweetalert2';
import { SidebarUserComponent } from "../../sidebar-user/sidebar-user.component";
import { HeaderComponent } from "../../header/header.component";

interface Gas {
  id: number;
  capacity: number;
  price: number;
  stock: number;
}

interface OrderGas {
  gasId: number;
  quantity: number;
  location?: string;  // Add location field
}

interface Order {
  id: number;
  status: string;
  tokenNumber: string;
  userId: number;
  deliveryScheduleId: number | null;
  outletId: number;
  orderGasList: OrderGas[];
  total: number;
}

@Component({
  selector: 'app-order',
  templateUrl: './order.component.html',
  styleUrls: ['./order.component.css'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule, FormsModule, HeaderComponent, SidebarUserComponent]
})
export class OrderComponent implements OnInit {
  paymentSuccess: boolean = false;
    paymentFailed: boolean = false;
    lastOrderId: number | string | null = null;
    generatedToken: string | null = null;
    isLoading: boolean = false;
    paypalPaymentId: string = '';
    processingPayment: boolean = false;
    currentStep: number = 1;
    totalSteps: number = 4;
    tokenKey: string | null = null;
    customerForm!: FormGroup;
    gasSelectionForm!: FormGroup;
    locationForm!: FormGroup;
    paymentForm!: FormGroup;
    availableGases: Gas[] = [];
    outletGases: Gas[] = [];
    selectedGases: OrderGas[] = [];
    outlets: any[] = [];
    showTokenPopup: boolean = false;
    outOfStock: boolean = false;
    order: Order = {
      id: 0,
      status: '',
      tokenNumber: '',
      userId: 0,
      deliveryScheduleId: null,
      outletId: 0,
      orderGasList: [],
      total: 0
    };
    orders: OrderSummaryDTO[] = [];
    newOrder: OrderSummaryDTO = {
      customerName: '',
      email: '',
      mobileNumber: '',
      userId: 0,
      gasId: 0,
      hasEmptyCylinder: false,
      location: '',
      outletId: '',
      quantity: 0,
      addressLine1: '',
      addressLine2: '',
      city: '',
      deliveryDate: '',
      deliveryTime: '',
      postalCode: '',
      paymentMethod: '',
      cardNumber: '',
      cvv: '',
      expiryDate: '',
      nameOnCard: ''
    };
    alertMessage: string = '';
    alertType: 'success' | 'error' = 'success';
    showAlert: boolean = false;

    constructor(
      private fb: FormBuilder,
      private http: HttpClient,
      private loginService: LoginService,
      private paypalService: PaypalService,
      private router: Router,
      private orderService: OrderService
    ) {}

    ngOnInit(): void {
      this.initializeForms();
      this.loadOutlets();
      this.loadGases();
      this.showStep(this.currentStep);
      this.loadUserDetails();
      this.fetchLastOrderId();
      this.loadOrderDetails();
    }

    loadOutlets(): void {
      this.orderService.getAllOutlets().subscribe((data: any[]) => {
        this.outlets = data;
      });
    }

    fetchLastOrderId(): void {
      this.orderService.getLastOrderId().subscribe(
        (response) => {
          this.lastOrderId = response;
          console.log('Last Order ID:', this.lastOrderId);
        },
        (error) => {
          console.error('Error fetching last order ID:', error);
        }
      );
    }
    onOutletChange(event: Event) {
      const selectedOutletId = (event.target as HTMLSelectElement).value;
      console.log("Selected Outlet ID:", selectedOutletId);
      this.loadGasesByOutlet(Number(selectedOutletId));
    }
    
    incrementQuantity() {
      const currentValue = this.gasSelectionForm.get('quantity')?.value || 0;
      this.gasSelectionForm.patchValue({ quantity: currentValue + 1 });
    }

    decrementQuantity() {
      const currentValue = this.gasSelectionForm.get('quantity')?.value || 0;
      if (currentValue > 1) {
        this.gasSelectionForm.patchValue({ quantity: currentValue - 1 });
      }
    }
    onPurchase(): void {
      const selectedGas = this.availableGases.find(gas => gas.id === this.gasSelectionForm.get('gasId')?.value);
      if (!selectedGas) {
        console.error("No gas selected");
        return;
      }

      const paymentDetails = {
        price: selectedGas.price,
        currency: 'USD',
        method: 'paypal',
        intent: 'sale',
        description: `Payment for gas: ${selectedGas.capacity} KG`
      };

      this.paypalService.createPayment(paymentDetails).subscribe({
        next: (response) => {
          if (response.redirectUrl) {
            window.open(response.redirectUrl, '_blank');
          }
        },
        error: (err) => {
          console.error("Payment failed", err);
        }
      });
    }

    private calculateTotalAmount(): number {
      return this.selectedGases.reduce((total, gasOrder) => {
        const gas = this.availableGases.find(g => g.id === gasOrder.gasId);
        return total + (gas ? gas.price * gasOrder.quantity : 0);
      }, 0);
    }

    private generateOrderId(): string {
      return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    private handlePaymentError(error: any): void {
      console.error('Payment error:', error);
      this.paymentFailed = true;
      setTimeout(() => {
        this.paymentFailed = false;
      }, 3000);
    }

    verifyPaypalPayment(paymentId: string): void {
      this.paypalService.verifyPayment(paymentId).subscribe({
        next: (response) => {
          if (response.status === 'completed') {
            this.onPaymentSuccess();
            this.completeOrder();
          } else {
            this.handlePaymentError('Payment verification failed');
          }
        },
        error: (error) => {
          this.handlePaymentError(error);
        }
      });
    }

    onPaymentSuccess(): void {
      this.paymentSuccess = true;
      this.processingPayment = false;
      setTimeout(() => {
        this.paymentSuccess = false;
        this.router.navigate(['/order']);
      }, 3000);
    }

    loadGasesByOutlet(id:number): void {
      this.orderService.getAllGassesByOutlet(id).subscribe((data:any) => {
        this.outletGases=data;
        console.log(data);
        
      })
    }

    loadGases(): void {
      this.orderService.getAllGases().subscribe((data: Gas[]) => {
        this.availableGases = data;
      });
    }

    private loadUserDetails() {
      const userDetails = localStorage.getItem('userDetails');
      if (userDetails) {
        const user = JSON.parse(userDetails);
        this.loginService.searchById(user.id).subscribe({
          next: (userData) => {
            this.customerForm.patchValue({
              name: userData.name,
              email: userData.email,
              mobileNumber: userData.contactNo,
              userId: userData.id
            });
            console.log('Loaded user details:', userData);
          },
          error: (error) => console.error('Error loading user details:', error)
        });
      }
    }

    private initializeForms() {
      this.customerForm = this.fb.group({
        name: [''],
        mobileNumber: [''],
        email: [''],
        userId: ['']
      });

      this.gasSelectionForm = this.fb.group({
        gasId: [''],
        quantity: [1],
        hasEmptyCylinder: [false],
        outletId: [''],
        location: ['']
      });

      this.locationForm = this.fb.group({
        addressLine1: [''],
        addressLine2: [''],
        city: [''],
        postalCode: [''],
        deliveryDate: [''],
        deliveryTime: ['']
      });

      this.paymentForm = this.fb.group({
        cardNumber: [''],
        expiryDate: [''],
        cvv: [''],
        nameOnCard: [''],
        paymentMethod: ['card']
      });
    }

    nextStep(): void {
      if (this.currentStep < this.totalSteps) {
        this.logStepData(this.currentStep);
        this.currentStep++;
      }
    }

    private logStepData(step: number) {
      switch (step) {
        case 1:
          console.log('Customer Details:', {
            formValues: this.customerForm.value,
            formStatus: this.customerForm.status,
            formValid: this.customerForm.valid
          });
          break;
        case 2:
          console.log('Gas Selection:', {
            formValues: this.gasSelectionForm.value,
            selectedGases: this.selectedGases,
            formStatus: this.gasSelectionForm.status,
            formValid: this.gasSelectionForm.valid
          });
          const gasId=this.gasSelectionForm.get('gasId')?.value;
          if(gasId){
            const gasItem=this.outletGases.find(g => g.id === gasId);
            if(gasItem && gasItem.stock < this.gasSelectionForm.get('quantity')?.value){
              this.outOfStock=true;
              console.log('Out of stock');
            }else{
              this.outOfStock=false;
              console.log('In stock');
            }
          }
          break;
        case 3:
          console.log('Location Details:', {
            formValues: this.locationForm.value,
            formStatus: this.locationForm.status,
            formValid: this.locationForm.valid
          });
          break;
      }
    }

    public validateCurrentStep(): boolean {
      return true;
    }

    completeOrder(): void {
      const orderData = {
        customer: {
          ...this.customerForm.value
        },
        gasSelection: {
          outletId: this.gasSelectionForm.get('outletId')?.value,
          hasEmptyCylinder: this.gasSelectionForm.get('hasEmptyCylinder')?.value,
          selectedGases: this.selectedGases
        },
        delivery: {
          address: {
            addressLine1: this.locationForm.get('addressLine1')?.value,
            addressLine2: this.locationForm.get('addressLine2')?.value,
            city: this.locationForm.get('city')?.value,
            postalCode: this.locationForm.get('postalCode')?.value
          },
          date: this.locationForm.get('deliveryDate')?.value,
          timeSlot: this.locationForm.get('deliveryTime')?.value
        },
        payment: {
          method: this.paymentForm.get('paymentMethod')?.value,
          details: this.paymentForm.get('paymentMethod')?.value === 'card' ? {
            cardNumber: this.paymentForm.get('cardNumber')?.value,
            expiryDate: this.paymentForm.get('expiryDate')?.value,
            cvv: this.paymentForm.get('cvv')?.value,
            nameOnCard: this.paymentForm.get('nameOnCard')?.value
          } : null
        },
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      console.log('Complete Order Data:', orderData);
      console.log('Form States:', {
        customerForm: {
          value: this.customerForm.value,
          valid: this.customerForm.valid,
          touched: this.customerForm.touched
        },
        gasSelectionForm: {
          value: this.gasSelectionForm.value,
          valid: this.gasSelectionForm.valid,
          touched: this.gasSelectionForm.touched
        },
        locationForm: {
          value: this.locationForm.value,
          valid: this.locationForm.valid,
          touched: this.locationForm.touched
        },
        paymentForm: {
          value: this.paymentForm.value,
          valid: this.paymentForm.valid,
          touched: this.paymentForm.touched
        }
      });

      this.router.navigate(['/order']).then(() => {
        window.location.reload();
      });
    }

    seeToken(orderId: number): void {
      if (!orderId) {
        console.error('Invalid order ID');
        return;
      }

      this.orderService.getOrderById(orderId).subscribe({
        next: (tokenResponse) => {
          this.generatedToken = tokenResponse.token; // Assuming the response contains a "token" field
          this.showTokenPopup = true;
        },
        error: (err) => {
          console.error('Error fetching order by ID:', err);
        },
      });
    }

    generateToken(): void {
      console.log("userId: " + this.customerForm.value);
      console.log("gasses: " + this.gasSelectionForm.get('gasId')?.value);
      console.log("gasses qty: " + this.gasSelectionForm.get('quantity')?.value);


      
      const tokenObject = {
        userId: this.customerForm.get('userId')?.value,
        outletId: this.gasSelectionForm.get('outletId')?.value,
        status: "Requested",
        orderGasList: [{
          gasId: this.gasSelectionForm.get('gasId')?.value,
          quantity: this.gasSelectionForm.get('quantity')?.value
        }]
      };

      console.log('Token Object:', tokenObject);
      console.log("creating shedule order object");

      this.orderService.createScheduleOrder(tokenObject).subscribe({        
        next: (response) => {
          const orderId = response.orderId;
          console.log('Gas requested successfully:', orderId);
          this.displayAlert('Gas requested successfully!', 'success');
        },
        error: (err) => {
          console.error('Error requesting order:', err);
          this.displayAlert('Error requesting order!', 'error');
        }
      });
    }
    

    displayAlert(message: string, type: 'success' | 'error'): void {
      Swal.fire({
        icon: type,
        title: type === 'success' ? 'Success' : 'Error',
        text: message,
        timer: 3000,
        showConfirmButton: false,
        position: 'top-end',
        toast: true
      });
    }
    calculateOrdertotal(): number {
      const gasId=Number(this.gasSelectionForm.get("gasId"));
      const buyQty=Number(this.gasSelectionForm.get("quantity"));
      const gasItem=this.availableGases.find(g => g.id === gasId);
      return gasItem ? gasItem.price * buyQty : 0;
    }

  placeOrder(): void {
      const orderObject = {
        status: "Delivered",
        userId: Number(this.customerForm.get('userId')?.value),
        outletId: Number(this.gasSelectionForm.get('outletId')?.value),
        orderGasList: [{
          gasId: this.gasSelectionForm.get("gasId")?.value,
          quantity: this.gasSelectionForm.get("quantity")?.value
        }],
        Total: this.calculateOrdertotal()
      };

      console.log('Place Order:', orderObject);

      this.orderService.createOrder(orderObject).subscribe({
        next: (response) => {
          const orderId = response.orderId;
          console.log('Order created successfully:', orderId);
          this.displayAlert('Order created successfully!', 'success');
        },
        error: (err) => {
          console.error('Error generating token:', err);
          this.displayAlert('Error generating token!', 'error');
        }
      });

      // this.orderService.createScheduleOrder(tokenObject).subscribe({
      //   next: (response) => {
      //     const orderId = response.orderId;
      //     console.log('Order created successfully:', orderId);
      //     this.displayAlert('Order created successfully!', 'success');
      //   },
      //   error: (err) => {
      //     console.error('Error generating token:', err);
      //     this.displayAlert('Error generating token!', 'error');
      //   }
      // });
    }


    fetchTokenNumber(): void {
      // if (!orderId) {
      //   console.error('Invalid order ID');
      //   return;
      // }

      this.orderService.generateToken().subscribe(
        (token: any) => {
          this.generatedToken = token.token;
          this.tokenKey = `New Token Key: ${this.generatedToken}`;
          this.showTokenPopup = true;
        },
        (error: any) => {
          console.error('Error fetching order:', error);
        }
      );
    }

    copyToken(): void {
      if (this.generatedToken) {
        navigator.clipboard.writeText(this.generatedToken).then(
          () => {
            console.log('Token copied to clipboard:', this.generatedToken);
          },
          (err) => {
            console.error('Failed to copy token:', err);
          }
        );
      } else {
        console.error('No token available to copy');
      }
    }

    closeTokenPopup(): void {
      this.showTokenPopup = false; // Close the popup
    }

    addGasToOrder() {
      const gasForm = this.gasSelectionForm.value;
      const selectedGas = this.availableGases.find(g => g.id === gasForm.gasId);

      if (selectedGas && gasForm.quantity <= selectedGas.stock) {
        this.selectedGases.push({
          gasId: gasForm.gasId,
          quantity: gasForm.quantity,
          location: gasForm.location  // Include location in the order
        });

        this.gasSelectionForm.patchValue({
          gasId: '',
          quantity: 1,
          location: ''  // Reset location field
        });

        console.log('Updated Gas Selection:', {
          selectedGases: this.selectedGases,
          formValues: this.gasSelectionForm.value
        });
      }
    }

    removeGasFromOrder(index: number) {
      this.selectedGases.splice(index, 1);
      console.log('Updated Gas Selection after removal:', {
        selectedGases: this.selectedGases
      });
    }

    showStep(step: number): void {
      this.currentStep = step;
    }

    prevStep(): void {
      if (this.currentStep > 1) {
        this.currentStep--;
        this.logStepData(this.currentStep);
      }
    }

    isStepActive(step: number): boolean {
      return step <= this.currentStep;
    }

    async downloadCoursePDF(order: Order): Promise<void> {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;

      // Background with gradient effect
      doc.setFillColor(247, 250, 252);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Add decorative header band
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, pageWidth, 50, 'F');

      // Company Logo/Name
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.text('GAS BY GAS', pageWidth / 2, 30, { align: 'center' });
      doc.setFontSize(12);
      doc.text('Your Trusted Gas Provider', pageWidth / 2, 42, { align: 'center' });

      // Decorative line
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(margin, 70, pageWidth - margin, 70);

      // Token Section
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(20);  // Reduced from 24
      doc.setFont('helvetica', 'bold');
      doc.text('COLLECTION TOKEN', pageWidth / 2, 90, { align: 'center' });

      // Token Box with shadow effect
      const tokenBoxY = 110;
      // Shadow effect
      doc.setFillColor(230, 236, 241);
      doc.rect(margin + 2, tokenBoxY - 8, pageWidth - (2 * margin), 50, 'F');  // Increased height to 50
      // Main box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(1);
      doc.rect(margin, tokenBoxY - 10, pageWidth - (2 * margin), 50, 'FD');  // Increased height to 50

      // Token Number (smaller size)
      doc.setFontSize(24);  // Reduced from 32
      doc.setTextColor(59, 130, 246);
      doc.text(this.generatedToken || '', pageWidth / 2, tokenBoxY + 10, { align: 'center' });  // Adjusted Y position

      // Additional Information (moved down)
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'normal');
      doc.text('Please present this token at the collection counter', pageWidth / 2, tokenBoxY + 35, { align: 'center' });  // Increased spacing

      // Adjusted validity section starting position
      const validityY = tokenBoxY + 70;  // Moved down to accommodate larger box

      // Validity Section
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      const today = new Date();
      const validUntil = new Date(today);
      validUntil.setDate(validUntil.getDate() + 7);

      doc.text('Generated on:', margin, validityY);
      doc.text(today.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }), margin + 70, validityY);

      doc.text('Valid until:', margin, validityY + 15);
      doc.text(validUntil.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }), margin + 70, validityY + 15);

      // Footer
      doc.setDrawColor(59, 130, 246);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);

      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text('Gas By Gas Pvt Ltd', margin, pageHeight - 20);
      doc.text('Contact: +94 11 234 5678', pageWidth - margin, pageHeight - 20, { align: 'right' });

      // Save with formatted name
      const formattedDate = new Date().toISOString().split('T')[0];
      doc.save(`GasByGas_Token_${this.generatedToken}_${formattedDate}.pdf`);
    }

    onDownloadClick(): void {
      this.downloadCoursePDF(this.order);
    }

    loadOrderDetails(): void {
      this.orderService.getAllOrders().subscribe((orders: any[]) => {
        if (orders.length > 0) {
          const latestOrder = orders[0]; // Assuming the latest order is the first one
          this.order = {
            id: latestOrder.id,
            status: latestOrder.status,
            tokenNumber: latestOrder.tokenNumber,
            userId: latestOrder.userId,
            deliveryScheduleId: latestOrder.deliveryScheduleId,
            outletId: latestOrder.outletId,
            orderGasList: latestOrder.orderGasList,
            total: latestOrder.total
          };
        }
      });
    }

    createOrder(): void {
      const orderData = {
        customerName: this.customerForm.get('name')?.value,
        email: this.customerForm.get('email')?.value,
        mobileNumber: this.customerForm.get('mobileNumber')?.value,
        userId: this.customerForm.get('userId')?.value,
        gasId: this.gasSelectionForm.get('gasId')?.value,
        hasEmptyCylinder: this.gasSelectionForm.get('hasEmptyCylinder')?.value,
        location: this.gasSelectionForm.get('location')?.value,
        outletId: this.gasSelectionForm.get('outletId')?.value,
        quantity: this.gasSelectionForm.get('quantity')?.value,
        addressLine1: this.locationForm.get('addressLine1')?.value,
        addressLine2: this.locationForm.get('addressLine2')?.value,
        city: this.locationForm.get('city')?.value,
        deliveryDate: this.locationForm.get('deliveryDate')?.value,
        deliveryTime: this.locationForm.get('deliveryTime')?.value,
        postalCode: this.locationForm.get('postalCode')?.value,
        paymentMethod: this.paymentForm.get('paymentMethod')?.value,
        cardNumber: this.paymentForm.get('cardNumber')?.value,
        cvv: this.paymentForm.get('cvv')?.value,
        expiryDate: this.paymentForm.get('expiryDate')?.value,
        nameOnCard: this.paymentForm.get('nameOnCard')?.value
      };

      this.orderService.createOrderSummary(orderData).subscribe(
        (createdOrder) => {
          this.orders.push(createdOrder);
          this.newOrder = {
            customerName: '',
            email: '',
            mobileNumber: '',
            userId: 0,
            gasId: 0,
            hasEmptyCylinder: false,
            location: '',
            outletId: '',
            quantity: 0,
            addressLine1: '',
            addressLine2: '',
            city: '',
            deliveryDate: '',
            deliveryTime: '',
            postalCode: '',
            paymentMethod: '',
            cardNumber: '',
            cvv: '',
            expiryDate: '',
            nameOnCard: ''
          };
         console.log('Order created successfully:', createdOrder);
        },
        (error) => console.error('Error creating order', error)
      );
    }

    calculateSubtotal(): number {
      return this.selectedGases.reduce((total, gas) => {
        const gasItem = this.availableGases.find(g => g.id === gas.gasId);
        return total + (gasItem ? gasItem.price * gas.quantity : 0);
      }, 0);
    }

    get deliveryFee(): number {
      return 50; // Fixed delivery fee
    }

    calculateTotal(): number {
      return this.calculateSubtotal() + this.deliveryFee;
    }
    selectPaymentMethod(method: string): void {
      this.paymentForm.patchValue({ paymentMethod: method });
    }
  }
