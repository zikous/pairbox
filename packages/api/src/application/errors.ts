export class NotFoundError extends Error {}

export class RoomNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Room ${id} not found`);
  }
}

export class RecordingNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Recording ${id} not found`);
  }
}

export class InvalidInputError extends Error {}

export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists");
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Wrong email or password");
  }
}

export class NotRoomOwnerError extends Error {
  constructor() {
    super("Only the room's owner can do this");
  }
}
