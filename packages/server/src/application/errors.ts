export class RoomNotFoundError extends Error {
  constructor(id: string) {
    super(`Room ${id} not found`);
  }
}

export class InvalidInputError extends Error {}
