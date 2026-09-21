export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const fetcher = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const result = await response.json();

  if (!response.ok) {
    throw new ApiError(result.message || 'Something went wrong', response.status);
  }

  return result;
};
