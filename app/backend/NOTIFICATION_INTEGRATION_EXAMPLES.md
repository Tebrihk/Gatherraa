# Real-Time Notification Service - Integration Examples

This guide shows practical examples of how to integrate the notification service into your existing modules.

## Table of Contents

1. [Reviews Module Integration](#reviews-module-integration)
2. [Events Module Integration](#events-module-integration)
3. [Tickets Module Integration](#tickets-module-integration)
4. [Frontend WebSocket Integration](#frontend-websocket-integration)

## Reviews Module Integration

### Background

The reviews module already has `sendReviewNotification()` and other notification methods that are currently just logging to console. Here's how to implement them properly.

### Step 1: Update ReviewsService

```typescript
// src/reviews/reviews.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationCategory } from '../notifications/entities';
import { Review } from './entities/review.entity';
import { Event } from '../events/entities/event.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private notificationsService: NotificationsService,
  ) {}

  async createReview(userId: string, eventId: string, dto: CreateReviewDto): Promise<Review> {
    // Validate event exists
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new Error('Event not found');
    }

    // Create review
    const review = this.reviewRepository.create({
      userId,
      eventId,
      ...dto,
    });
    await this.reviewRepository.save(review);

    // Send notification to event organizer
    try {
      await this.notificationsService.sendReviewNotification(review, event);
    } catch (error) {
      // Log error but don't fail the review creation
      console.error('Failed to send review notification:', error);
    }

    return review;
  }

  async flagReview(reviewId: string, reason: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
    if (!review) throw new Error('Review not found');

    const event = await this.eventRepository.findOne({ where: { id: review.eventId } });
    if (!event) throw new Error('Event not found');

    review.flagged = true;
    review.flagReason = reason;
    await this.reviewRepository.save(review);

    // Notify moderators
    try {
      await this.notificationsService.sendModerationNotification(review, event);
    } catch (error) {
      console.error('Failed to send moderation notification:', error);
    }

    return review;
  }

  async updateReviewStatus(reviewId: string, status: 'approved' | 'rejected', reason?: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
    if (!review) throw new Error('Review not found');

    const event = await this.eventRepository.findOne({ where: { id: review.eventId } });
    if (!event) throw new Error('Event not found');

    review.moderationStatus = status;
    review.moderationReason = reason;
    await this.reviewRepository.save(review);

    // Notify review author
    try {
      await this.notificationsService.sendModerationResultNotification(review, status, reason);
    } catch (error) {
      console.error('Failed to send moderation result notification:', error);
    }

    return review;
  }

  async addReport(reviewId: string, reportedBy: string, reason: string): Promise<void> {
    const review = await this.reviewRepository.findOne({ where: { id: reviewId } });
    if (!review) throw new Error('Review not found');

    const event = await this.eventRepository.findOne({ where: { id: review.eventId } });
    if (!event) throw new Error('Event not found');

    review.reportCount = (review.reportCount || 0) + 1;
    await this.reviewRepository.save(review);

    // Notify if threshold reached
    try {
      await this.notificationsService.sendReportNotification(review, event, review.reportCount);
    } catch (error) {
      console.error('Failed to send report notification:', error);
    }
  }
}
```

### Step 2: Update ReviewsModule

```typescript
// src/reviews/reviews.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { Review } from './entities/review.entity';
import { Event } from '../events/entities/event.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Event]),
    NotificationsModule, // Add this
  ],
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [ReviewsService],
})
export class ReviewsModule {}
```

## Events Module Integration

### Send Event Reminders

```typescript
// src/events/events.service.ts

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationCategory } from '../notifications/entities';

@Injectable()
export class EventsService {
  constructor(
    // ... other dependencies ...
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Send reminders for events starting in 1 hour
   * Runs every 15 minutes
   */
  @Cron('0 */15 * * * *')
  async sendEventReminders() {
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Find events starting in the next hour
    const upcomingEvents = await this.eventRepository.find({
      where: {
        startsAt: Between(thirtyMinutesAgo, oneHourFromNow),
        cancelled: false,
      },
    });

    for (const event of upcomingEvents) {
      try {
        // Get all attendees
        const attendees = await this.getEventAttendees(event.id);
        const attendeeIds = attendees.map((a) => a.userId);

        if (attendeeIds.length === 0) continue;

        const timeUntilStart = Math.floor((event.startsAt.getTime() - Date.now()) / (60 * 1000));

        // Send bulk notification
        await this.notificationsService.sendBulkNotifications({
          userIds: attendeeIds,
          types: [NotificationType.PUSH, NotificationType.IN_APP],
          category: NotificationCategory.EVENT_REMINDER,
          title: `${event.name} starts soon!`,
          message: `Your event starts in ${timeUntilStart} minutes`,
          metadata: {
            eventId: event.id,
            actionUrl: `/events/${event.id}`,
          },
          respectPreferences: true,
        });

        this.logger.log(`Sent reminders for event ${event.id} to ${attendeeIds.length} users`);
      } catch (error) {
        this.logger.error(`Failed to send reminders for event ${event.id}: ${error.message}`);
      }
    }
  }

  /**
   * Send thank you notifications after event ends
   */
  async onEventEnded(eventId: string) {
    try {
      const event = await this.eventRepository.findOne({ where: { id: eventId } });
      if (!event) return;

      const attendees = await this.getEventAttendees(eventId);
      const attendeeIds = attendees.map((a) => a.userId);

      await this.notificationsService.sendBulkNotifications({
        userIds: attendeeIds,
        types: [NotificationType.IN_APP, NotificationType.EMAIL],
        category: NotificationCategory.SYSTEM_ALERT,
        title: 'Thanks for attending!',
        message: `Thank you for attending ${event.name}. We'd love your feedback!`,
        metadata: {
          eventId: event.id,
          actionUrl: `/events/${event.id}/review`,
        },
      });

      this.logger.log(`Sent thank you notifications for event ${eventId}`);
    } catch (error) {
      this.logger.error(`Failed to send thank you notifications: ${error.message}`);
    }
  }

  private getEventAttendees(eventId: string) {
    // Implementation depends on your ticket/attendance structure
    // This is a placeholder
    return [];
  }
}
```

## Tickets Module Integration

### Notify on Ticket Purchase

```typescript
// src/tickets/tickets.service.ts

import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType, NotificationCategory } from '../notifications/entities';

@Injectable()
export class TicketsService {
  constructor(
    // ... other dependencies ...
    private notificationsService: NotificationsService,
  ) {}

  async purchaseTicket(userId: string, eventId: string, ticketTypeId: string) {
    // Create ticket
    const ticket = await this.createTicket(userId, eventId, ticketTypeId);

    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    const user = await this.userRepository.findOne({ where: { id: userId } });

    try {
      // Notify organizer of sale
      await this.notificationsService.createAndSendNotification({
        userId: event.organizerId,
        type: NotificationType.IN_APP,
        category: NotificationCategory.TICKET_SALE,
        title: 'Ticket Sold!',
        message: `${user.firstName} ${user.lastName} purchased a ticket to ${event.name}`,
        metadata: {
          ticketId: ticket.id,
          eventId: event.id,
          buyerId: userId,
          actionUrl: `/events/${event.id}/attendees`,
        },
        sendImmediately: true,
      });

      // Send confirmation to buyer
      await this.notificationsService.createAndSendNotification({
        userId,
        type: NotificationType.EMAIL,
        category: NotificationCategory.TICKET_SALE,
        title: `Ticket Confirmation: ${event.name}`,
        message: `Your ticket for ${event.name} on ${event.startsAt.toLocaleDateString()} has been confirmed.`,
        metadata: {
          ticketId: ticket.id,
          eventId: event.id,
          actionUrl: `/tickets/${ticket.id}`,
        },
        sendImmediately: true,
      });

      this.logger.log(`Sent notifications for ticket sale ${ticket.id}`);
    } catch (error) {
      this.logger.error(`Failed to send ticket sale notifications: ${error.message}`);
    }

    return ticket;
  }

  async refundTicket(ticketId: string) {
    const ticket = await this.ticketRepository.findOne({ where: { id: ticketId } });
    const event = await this.eventRepository.findOne({ where: { id: ticket.eventId } });

    // Process refund...
    ticket.status = 'refunded';
    await this.ticketRepository.save(ticket);

    try {
      // Notify buyer
      await this.notificationsService.createAndSendNotification({
        userId: ticket.userId,
        type: NotificationType.EMAIL,
        category: NotificationCategory.TICKET_SALE,
        title: 'Ticket Refunded',
        message: `Your ticket for ${event.name} has been refunded.`,
        data: {
          refundAmount: ticket.price,
        },
        sendImmediately: true,
      });

      // Notify organizer
      await this.notificationsService.createAndSendNotification({
        userId: event.organizerId,
        type: NotificationType.IN_APP,
        category: NotificationCategory.TICKET_SALE,
        title: 'Ticket Refunded',
        message: `A ticket to ${event.name} has been refunded`,
        metadata: {
          ticketId: ticket.id,
          eventId: event.id,
        },
        sendImmediately: true,
      });
    } catch (error) {
      this.logger.error(`Failed to send refund notifications: ${error.message}`);
    }
  }
}
```

## Frontend WebSocket Integration

### React Hook for Notifications

```typescript
// frontend/hooks/useNotifications.ts

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Notification {
  id: string;
  title: string;
  message: string;
  category: string;
  type: string;
  createdAt: string;
  read: boolean;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

export const useNotifications = (jwtToken: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!jwtToken) return;

    const newSocket = io('http://localhost:3000/notifications', {
      auth: {
        token: jwtToken,
      },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connection_established', () => {
      console.log('Connected to notification service');
      setIsConnected(true);
      newSocket.emit('get_unread_count');
    });

    newSocket.on('notification_received', (notification: Notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
      notifyUser(notification);
    });

    newSocket.on('unread_count', ({ count }) => {
      setUnreadCount(count);
    });

    newSocket.on('notification_read', ({ notificationId }) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [jwtToken]);

  const markAsRead = useCallback(
    (notificationId: string) => {
      socket?.emit('mark_as_read', { notificationId });
    },
    [socket],
  );

  const markAllAsRead = useCallback(() => {
    socket?.emit('mark_all_as_read');
  }, [socket]);

  const deleteNotification = useCallback(
    (notificationId: string) => {
      socket?.emit('delete_notification', { notificationId });
    },
    [socket],
  );

  const notifyUser = (notification: Notification) => {
    // Show browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
      });
    }
  };

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
};
```

### React Component Usage

```typescript
// frontend/components/NotificationCenter.tsx

import React from 'react';
import { useNotifications } from '../hooks/useNotifications';

export const NotificationCenter: React.FC<{ jwtToken: string }> = ({ jwtToken }) => {
  const { notifications, unreadCount, markAsRead, deleteNotification } =
    useNotifications(jwtToken);

  return (
    <div className="notification-center">
      <div className="notification-badge">{unreadCount}</div>

      <div className="notification-list">
        {notifications.length === 0 ? (
          <p>No notifications</p>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${notification.read ? 'read' : 'unread'}`}
            >
              <div className="notification-header">
                <h4>{notification.title}</h4>
                <button onClick={() => deleteNotification(notification.id)}>×</button>
              </div>

              <p>{notification.message}</p>

              <div className="notification-footer">
                <span className="category">{notification.category}</span>
                <time>{new Date(notification.createdAt).toLocaleString()}</time>

                {!notification.read && (
                  <button onClick={() => markAsRead(notification.id)}>Mark as read</button>
                )}

                {notification.metadata?.actionUrl && (
                  <a href={notification.metadata.actionUrl} className="action-link">
                    View →
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
```

## Key Integration Points Summary

| Module              | Event                    | Notification                         |
| ------------------- | ------------------------ | ------------------------------------ |
| **Reviews**         | New review created       | Notify organizer (in-app)            |
| **Reviews**         | Review flagged           | Notify moderators (email)            |
| **Reviews**         | Review moderated         | Notify author (in-app)               |
| **Events**          | Event starting soon      | Notify attendees (push, in-app)      |
| **Events**          | Event ended              | Thank you notification (email)       |
| **Tickets**         | Ticket purchased         | Notify organizer & buyer (email)     |
| **Tickets**         | Ticket refunded          | Notify buyer & organizer (email)     |
| **Users**           | New user registration    | Welcome email                        |
| **Users**           | User gained follower     | Follow notification (in-app)         |
| **Comments**        | New comment on event     | Notify organizer (push)              |
| **System**          | Error/alert event        | Notify admins (email, system alert)  |

This integration framework allows your application to provide real-time, multi-channel notifications while respecting user preferences and maintaining a great user experience.
