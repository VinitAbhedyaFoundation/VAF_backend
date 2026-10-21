import {
    BadRequestException,
    ConflictException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';

import { Test, TestingModule } from '@nestjs/testing';

import {
    AttendanceStatus,
    BloodGroup,
    Gender,
    Occupation,
    Role,
    UserStatus,
    Prisma,
} from '@prisma/client';

import { DatabaseService } from '../database/database.service';
import { UserService } from './user.service';


describe('UserService', () => {
    let service: UserService;
    let database: {
        user: {
            findUnique: jest.Mock;
            findFirst: jest.Mock;
            findMany: jest.Mock;
            create: jest.Mock;
            update: jest.Mock;
            delete: jest.Mock;
        };
        drive: {
            findUnique: jest.Mock;
            findFirst: jest.Mock;
            update: jest.Mock;
        };
        participation: {
            findUnique: jest.Mock;
            findMany: jest.Mock;
            create: jest.Mock;
            update: jest.Mock;
            updateMany: jest.Mock;
        };
        $transaction: jest.Mock;
    };

    const userFixture = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        role: Role.User,
        status: UserStatus.Approved,
        gender: Gender.Male,
        bloodGroup: BloodGroup.O_POSITIVE,
        occupation: Occupation.Student,
        ploggerId: '2610001',
        phone: '9876543210',
        parentNumber: '9876543211',
        birthDate: new Date('2000-01-15'),
        highestQualification: 'Graduate',
        address: 'Pune',
        city: 'Pune',
        state: 'Maharashtra',
        collegeOrCompany: 'Test College',
        drivesCount: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    beforeEach(async () => {
        database = {
            user: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            },
            drive: {
                findUnique: jest.fn(),
                findFirst: jest.fn(),
                update: jest.fn(),
            },

            participation: {
                findUnique: jest.fn(),
                findMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                updateMany: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation(async (transaction) => {
                if (typeof transaction === 'function') {
                    return transaction(database);
                }

                return Promise.all(transaction);
            }),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: DatabaseService,
                    useValue: database,
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getUserById', () => {
        it('should return user details without the password', async () => {
            const { password: _password, ...safeUser } = userFixture;
            database.user.findUnique.mockResolvedValue(safeUser);

            const result = await service.getUserById(1);

            expect(result.message).toBe('User Details');
            expect(result.user).not.toHaveProperty('password');

            expect(database.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    select: expect.objectContaining({
                        id: true,
                        email: true,
                        role: true,
                    }),
                }),
            );
        });

        it('should throw NotFoundException for an unknown attendance record', async () => {
            database.participation.updateMany.mockResolvedValue({ count: 0 });
            database.participation.findUnique.mockResolvedValue(null);

            await expect(
                service.rejectAttendance(999),
            ).rejects.toThrow(NotFoundException);
        });

        it('should convert database errors to InternalServerErrorException', async () => {
            jest.spyOn(service['logger'], 'error').mockImplementation(() => { });

            database.user.findUnique.mockRejectedValue(
                new Error('Database failure'),
            );

            await expect(service.getUserById(1)).rejects.toThrow(
                InternalServerErrorException,
            );
        });
    });

    describe('updateProfile', () => {
        it('should update only the supplied profile fields', async () => {
            database.user.findUnique.mockResolvedValue(userFixture);
            database.user.update.mockResolvedValue({
                id: 1,
                name: 'Updated Name',
                email: userFixture.email,
            });

            const result = await service.updateProfile(1, {
                name: 'Updated Name',
            });

            expect(result.message).toBe('Profile updated successfully');
            expect(database.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: { name: 'Updated Name' },
                }),
            );
        });

        it('should convert a birth date string to a Date', async () => {
            database.user.findUnique.mockResolvedValue(userFixture);
            database.user.update.mockResolvedValue({
                id: 1,
                birthDate: new Date('2001-02-03'),
            });

            await service.updateProfile(1, {
                birthDate: '2001-02-03',
            });

            expect(database.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: {
                        birthDate: new Date('2001-02-03'),
                    },
                }),
            );
        });

        it('should throw NotFoundException when the user does not exist', async () => {
            database.user.findUnique.mockResolvedValue(null);

            await expect(
                service.updateProfile(999, { name: 'Updated Name' }),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('approveUser', () => {
        it('should approve an existing user', async () => {
            database.user.findUnique.mockResolvedValue(userFixture);
            database.user.update.mockResolvedValue({
                id: 1,
                name: userFixture.name,
                email: userFixture.email,
                role: Role.User,
                status: UserStatus.Approved,
                ploggerId: userFixture.ploggerId,
            });

            const result = await service.approveUser(1);

            expect(result.message).toBe('User approved successfully');
            expect(database.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: { status: UserStatus.Approved },
                }),
            );
        });

        it('should reject modifying a SuperAdmin', async () => {
            database.user.findUnique.mockResolvedValue({
                ...userFixture,
                role: Role.SuperAdmin,
            });

            await expect(service.approveUser(1)).rejects.toThrow(
                BadRequestException,
            );
            expect(database.user.update).not.toHaveBeenCalled();
        });

        it('should throw NotFoundException for an unknown user', async () => {
            database.user.findUnique.mockResolvedValue(null);

            await expect(service.approveUser(999)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('suspendUser', () => {
        it('should suspend an existing user', async () => {
            database.user.findUnique.mockResolvedValue(userFixture);
            database.user.update.mockResolvedValue({
                id: 1,
                name: userFixture.name,
                email: userFixture.email,
                role: Role.User,
                status: UserStatus.Suspended,
                ploggerId: userFixture.ploggerId,
            });

            const result = await service.suspendUser(1);

            expect(result.message).toBe('User suspended successfully');
            expect(database.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: { status: UserStatus.Suspended },
                }),
            );
        });

        it('should not suspend a SuperAdmin', async () => {
            database.user.findUnique.mockResolvedValue({
                ...userFixture,
                role: Role.SuperAdmin,
            });

            await expect(service.suspendUser(1)).rejects.toThrow(
                BadRequestException,
            );
            expect(database.user.update).not.toHaveBeenCalled();
        });
    });

    describe('deleteUser', () => {
        it('should delete a regular user', async () => {
            database.user.findUnique.mockResolvedValue(userFixture);
            database.user.delete.mockResolvedValue(userFixture);

            const result = await service.deleteUser(1);

            expect(result.message).toBe('User deleted successfully');
            expect(database.user.delete).toHaveBeenCalledWith({
                where: { id: 1 },
            });
        });

        it('should prevent deleting a SuperAdmin', async () => {
            database.user.findUnique.mockResolvedValue({
                ...userFixture,
                role: Role.SuperAdmin,
            });

            await expect(service.deleteUser(1)).rejects.toThrow(
                BadRequestException,
            );
            expect(database.user.delete).not.toHaveBeenCalled();
        });
    });

    describe('promoteUser', () => {
        it('should promote a regular user to Admin', async () => {
            database.user.findUnique.mockResolvedValue(userFixture);
            database.user.update.mockResolvedValue({
                id: 1,
                name: userFixture.name,
                email: userFixture.email,
                role: Role.Admin,
                status: UserStatus.Approved,
                ploggerId: userFixture.ploggerId,
            });

            const result = await service.promoteUser(1);

            expect(result.message).toBe('User promoted to Admin successfully');
            expect(database.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: {
                        role: Role.Admin,
                        status: UserStatus.Approved,
                    },
                }),
            );
        });

        it('should reject promoting an existing Admin', async () => {
            database.user.findUnique.mockResolvedValue({
                ...userFixture,
                role: Role.Admin,
            });

            await expect(service.promoteUser(1)).rejects.toThrow(
                BadRequestException,
            );
            expect(database.user.update).not.toHaveBeenCalled();
        });
    });

    describe('getUserByPloggerId', () => {
        it('should find a user by Plogger ID', async () => {
            database.user.findUnique.mockResolvedValue({
                id: 1,
                name: userFixture.name,
                email: userFixture.email,
                role: Role.User,
                ploggerId: userFixture.ploggerId,
                status: UserStatus.Approved,
            });

            const result = await service.getUserByPloggerId('2610001');

            expect(result.message).toBe('User Details');
            expect(database.user.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { ploggerId: '2610001' },
                }),
            );
        });

        it('should throw NotFoundException for an unknown Plogger ID', async () => {
            database.user.findUnique.mockResolvedValue(null);

            await expect(
                service.getUserByPloggerId('UNKNOWN'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('getAllUsers', () => {
        it('should calculate totals using approved participations only', async () => {
            database.user.findMany.mockResolvedValue([
                {
                    ...userFixture,
                    participations: [
                        { status: 'Approved', hours: 3, waste: 2 },
                        { status: 'Approved', hours: 4, waste: 5 },
                        { status: 'Pending', hours: 10, waste: 10 },
                    ],
                },
            ]);

            const result = await service.getAllUsers();

            expect(result.users[0]).toEqual(
                expect.objectContaining({
                    totalDrives: 2,
                    drivesCount: 2,
                    totalHours: 7,
                    totalWaste: 7,
                    wasteKg: 7,
                    score: 24,
                }),
            );
        });

        it('should return an empty list when there are no users', async () => {
            database.user.findMany.mockResolvedValue([]);

            const result = await service.getAllUsers();

            expect(result.users).toEqual([]);
        });
    });

    describe('getLeaderboard', () => {
        it('should rank approved volunteers by score', async () => {
            database.user.findMany.mockResolvedValue([
                {
                    ...userFixture,
                    id: 1,
                    participations: [
                        { status: 'Approved', hours: 2, waste: 3 },
                    ],
                },
                {
                    ...userFixture,
                    id: 2,
                    name: 'Top Volunteer',
                    ploggerId: '2610002',
                    participations: [
                        { status: 'Approved', hours: 10, waste: 10 },
                    ],
                },
            ]);

            const result = await service.getLeaderboard();

            expect(result.leaderboard[0]).toEqual(
                expect.objectContaining({
                    id: 2,
                    name: 'Top Volunteer',
                    rank: 1,
                    totalDrives: 1,
                    totalHours: 10,
                    totalWaste: 10,
                    score: 25,
                }),
            );
            expect(result.leaderboard[1].rank).toBe(2);
        });

        it('should return an empty leaderboard when no users qualify', async () => {
            database.user.findMany.mockResolvedValue([]);

            const result = await service.getLeaderboard();

            expect(result.leaderboard).toEqual([]);
        });
    });

    describe('searchUsers', () => {
        it('should reject an empty query', async () => {
            await expect(service.searchUsers('')).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should search users by name, email, or Plogger ID', async () => {
            database.user.findMany.mockResolvedValue([
                {
                    id: 1,
                    name: userFixture.name,
                    email: userFixture.email,
                    ploggerId: userFixture.ploggerId,
                    role: Role.User,
                    status: UserStatus.Approved,
                    createdAt: userFixture.createdAt,
                },
            ]);

            const result = await service.searchUsers('Test');

            expect(result.users).toHaveLength(1);
            expect(database.user.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        OR: expect.arrayContaining([
                            {
                                name: {
                                    contains: 'Test',
                                    mode: 'insensitive',
                                },
                            },
                        ]),
                    },
                }),
            );
        });
    });

    describe('markAttendance', () => {
        it('should create attendance successfully', async () => {
            database.drive.findUnique.mockResolvedValue({
                id: 10,
                expiryDate: null,
                completed: false,
            });

            database.participation.create.mockResolvedValue({
                id: 1,
                userId: 1,
                driveId: 10,
                status: AttendanceStatus.Pending,
                attendanceMarked: true,
            });

            const result = await service.markAttendance('TEMP12345', 1);

            expect(result.message).toBe('Attendance submitted for approval');

            expect(database.drive.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { temporaryToken: 'TEMP12345' },
                }),
            );

            expect(database.participation.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        userId: 1,
                        driveId: 10,
                        status: AttendanceStatus.Pending,
                        attendanceMarked: true,
                    }),
                }),
            );

            expect(database.$transaction).not.toHaveBeenCalled();
            expect(database.user.update).not.toHaveBeenCalled();
            expect(database.drive.update).not.toHaveBeenCalled();
        });

        it('should reject an empty token', async () => {
            await expect(service.markAttendance('', 1)).rejects.toThrow(
                BadRequestException,
            );
        });

        it('should reject an invalid token', async () => {
            database.drive.findUnique.mockResolvedValue(null);

            await expect(
                service.markAttendance('INVALID', 1),
            ).rejects.toThrow(NotFoundException);

            expect(database.participation.create).not.toHaveBeenCalled();
        });

        it('should reject duplicate attendance', async () => {
            database.drive.findUnique.mockResolvedValue({
                id: 10,
                expiryDate: null,
                completed: false,
            });

            database.participation.create.mockRejectedValue(
                new Prisma.PrismaClientKnownRequestError(
                    'Unique constraint failed',
                    {
                        code: 'P2002',
                        clientVersion: 'test',
                    },
                ),
            );

            await expect(
                service.markAttendance('TEMP12345', 1),
            ).rejects.toThrow(ConflictException);
        });
    });

    describe('drivesAttended', () => {
        it('should return the drives associated with a user', async () => {
            database.participation.findMany.mockResolvedValue([
                {
                    hours: 3,
                    waste: 2,
                    status: 'Approved',
                    drive: {
                        id: 10,
                        date: new Date('2026-01-01'),
                        totalHours: 4,
                        driveLocation: { location: 'Pune' },
                    },
                },
            ]);

            const result = await service.drivesAttended(1);

            expect(result.drives).toEqual([
                expect.objectContaining({
                    id: 10,
                    hours: 3,
                    waste: 2,
                    status: 'Approved',
                    location: 'Pune',
                }),
            ]);
        });

        it('should return an empty list when the user has no participations', async () => {
            database.participation.findMany.mockResolvedValue([]);

            const result = await service.drivesAttended(1);

            expect(result.drives).toEqual([]);
            expect(result.message).toBe('No drives attended');
        });
    });

    describe('getPendingAttendance', () => {
        it('should return pending attendance records', async () => {
            database.participation.findMany.mockResolvedValue([]);

            const result = await service.getPendingAttendance();

            expect(result.attendance).toEqual([]);
            expect(database.participation.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { status: 'Pending' },
                }),
            );
        });
    });

    describe('approveAttendance', () => {
        it('should approve attendance and use drive hours when hours are omitted', async () => {
            database.participation.findUnique
                .mockResolvedValueOnce({
                    id: 5,
                    userId: 1,
                    driveId: 10,
                    status: AttendanceStatus.Pending,
                    hours: 0,
                    waste: 0,
                    drive: { totalHours: 4 },
                })
                .mockResolvedValueOnce({
                    id: 5,
                    userId: 1,
                    driveId: 10,
                    status: AttendanceStatus.Approved,
                    hours: 4,
                    waste: 0,
                });

            database.participation.updateMany.mockResolvedValue({ count: 1 });
            database.user.update.mockResolvedValue({ id: 1 });
            database.drive.update.mockResolvedValue({ id: 10 });

            const result = await service.approveAttendance(5);

            expect(result.message).toBe('Attendance approved successfully');

            expect(database.participation.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        id: 5,
                        status: AttendanceStatus.Pending,
                    },
                    data: expect.objectContaining({
                        status: AttendanceStatus.Approved,
                        attendanceMarked: true,
                        hours: 4,
                        waste: 0,
                    }),
                }),
            );

            expect(database.user.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 1 },
                    data: { drivesCount: { increment: 1 } },
                }),
            );

            expect(database.drive.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 10 },
                    data: { volunteerCount: { increment: 1 } },
                }),
            );
        });

        it('should apply explicitly supplied hours and waste', async () => {
            database.participation.findUnique
                .mockResolvedValueOnce({
                    id: 5,
                    userId: 1,
                    driveId: 10,
                    status: AttendanceStatus.Pending,
                    hours: 0,
                    waste: 0,
                    drive: { totalHours: 4 },
                })
                .mockResolvedValueOnce({
                    id: 5,
                    userId: 1,
                    driveId: 10,
                    status: AttendanceStatus.Approved,
                    hours: 3,
                    waste: 5,
                });

            database.participation.updateMany.mockResolvedValue({ count: 1 });
            database.user.update.mockResolvedValue({ id: 1 });
            database.drive.update.mockResolvedValue({ id: 10 });

            const result = await service.approveAttendance(5, 3, 5);

            expect(result.message).toBe('Attendance approved successfully');

            expect(database.participation.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: AttendanceStatus.Approved,
                        attendanceMarked: true,
                        hours: 3,
                        waste: 5,
                    }),
                }),
            );
        });

        it('should throw NotFoundException for an unknown attendance record', async () => {
            database.participation.findUnique.mockResolvedValue(null);

            await expect(service.approveAttendance(999)).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('rejectAttendance', () => {
        it('should reject an attendance record', async () => {
            database.participation.updateMany.mockResolvedValue({ count: 1 });

            database.participation.findUnique.mockResolvedValue({
                id: 5,
                status: AttendanceStatus.Rejected,
            });

            const result = await service.rejectAttendance(5);

            expect(result.message).toBe('Attendance rejected successfully');

            expect(database.participation.updateMany).toHaveBeenCalledWith({
                where: {
                    id: 5,
                    status: AttendanceStatus.Pending,
                },
                data: {
                    status: AttendanceStatus.Rejected,
                },
            });
        });

        it('should throw NotFoundException for an unknown attendance record', async () => {
            database.participation.updateMany.mockResolvedValue({ count: 0 });
            database.participation.findUnique.mockResolvedValue(null);

            await expect(
                service.rejectAttendance(999),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('createUserId', () => {
        it('should generate an ID using the latest user ID and gender', async () => {
            database.user.findFirst.mockResolvedValue({ id: 12 });

            const result = await service.createUserId(Gender.Male);

            expect(result).toMatch(/^\d{8}$/);
            expect(result.slice(2, 3)).toBe('1');
            expect(result.slice(3)).toBe('00013');
        });

        it('should start with ID 1 when there are no users', async () => {
            database.user.findFirst.mockResolvedValue(null);

            const result = await service.createUserId(Gender.Female);

            expect(result.slice(2, 3)).toBe('2');
            expect(result.slice(3)).toBe('00001');
        });
    });

    describe('createVolunteer', () => {
        it('should reject an already registered email', async () => {
            database.user.findUnique.mockResolvedValue(userFixture);

            await expect(
                service.createVolunteer({
                    name: 'New Volunteer',
                    email: userFixture.email,
                    gender: Gender.Male,
                    password: 'StrongPass123',
                }),
            ).rejects.toThrow(ConflictException);

            expect(database.user.create).not.toHaveBeenCalled();
        });

        it('should create a volunteer with a hashed password', async () => {
            database.user.findUnique.mockResolvedValue(null);
            database.user.findFirst.mockResolvedValue({ id: 10 });
            database.user.create.mockImplementation(async ({ data }) => ({
                id: 11,
                name: data.name,
                email: data.email,
                city: data.city,
                gender: data.gender,
                role: data.role,
                status: data.status,
                ploggerId: data.ploggerId,
            }));

            const result = await service.createVolunteer({
                name: 'New Volunteer',
                email: 'new@example.com',
                city: 'Pune',
                gender: Gender.Male,
                password: 'StrongPass123',
            });

            expect(result.message).toBe('Volunteer created successfully');

            const createCall = database.user.create.mock.calls[0][0];
            expect(createCall.data.password).not.toBe('StrongPass123');
            expect(createCall.data.password).toEqual(expect.any(String));
            expect(createCall.data.role).toBe(Role.User);
            expect(createCall.data.status).toBe(UserStatus.Pending);
        });
    });
});