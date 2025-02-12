import { Component, OnInit } from '@angular/core';
import { AdminDheaderComponent } from "../admin-dheader/admin-dheader.component";
import { OrderSummaryDTO } from '../../model/order-summary.model';
import { LoginService } from '../../service/login.service';
import { OrderService } from '../../service/order.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Import FormsModule

import { AdminSidebarComponent } from "../admin-sidebar/admin-sidebar.component";
import { deliverShedule } from '../../model/deliver-shedule.model';
import { deliverOrderShedule } from '../../model/deliver-order-shedule.model';


@Component({
  selector: 'app-admin-dashboard',
  imports: [AdminDheaderComponent, CommonModule, AdminSidebarComponent, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  userDetails: any = null;
  orders: OrderSummaryDTO[] = [];
  deliverShedules:deliverShedule[] = [];
  selectedSchedule:deliverShedule|null = null;
  showPopup = false;

  constructor(
    private loginService: LoginService,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    const storedDetails = localStorage.getItem('userDetails');
    if (storedDetails) {
      this.userDetails = JSON.parse(storedDetails);
      console.log('Loaded user details:', this.userDetails);
    }
    this.loadAllOrderSummaries();
    this.getAllDeliveryShedules();
  }

  isLoggedIn(): boolean {
    return this.loginService.isLoggedIn();
  }

  getUserRole(): string {
    if (this.userDetails && this.userDetails.roles && this.userDetails.roles.length > 0) {
      return this.userDetails.roles[0].replace('ROLE_', '');
    }
    return '';
  }

  getAllDeliveryShedules(): void {
    this.orderService.getSheduleDeliveries().subscribe(
      (deliverShedules: deliverShedule[]) => {
        this.deliverShedules = deliverShedules;
        console.log('Loaded all delivery shedules:', deliverShedules);
      },
      (error) => console.error('Error loading delivery shedules', error)
    );
  }

  openPopup(schedule: deliverShedule): void {
    console.log("openPopup", schedule);
    
    this.selectedSchedule = schedule;
    this.showPopup = true;
  }

  closePopup(): void {
    this.showPopup = false;
    this.selectedSchedule = null;
  }

  deliver(selectedSchedule:deliverShedule): void {
    console.log('Delivering------:', this.selectedSchedule);
    const deliverOrderShedule:deliverOrderShedule={
      deliveryScheduleId: selectedSchedule.id,
      deliveredGases: selectedSchedule.deliveryGasDTOS

    };
    this.orderService.deliverShedule(deliverOrderShedule).subscribe({
      next: () => {
        this.getAllDeliveryShedules();
        this.closePopup();
      },
      error: (error) => console.error("Error delivering schedule:", error)
    });
    
  }


  loadAllOrderSummaries(): void {
    this.orderService.getAllOrderSummary().subscribe(
      (orders) => {
        this.orders = orders;
        console.log('Loaded all order summaries:', orders);
      },
      (error) => console.error('Error loading order summaries', error)
    );
  }

  deleteOrder(id: number): void {
    this.orderService.deleteOrderSummary(id).subscribe(
      () => {
        this.orders = this.orders.filter(order => order.id !== id);
        console.log(`Order with ID ${id} deleted successfully.`);
      },
      (error) => console.error(`Error deleting order with ID ${id}`, error)
    );
  }
}
