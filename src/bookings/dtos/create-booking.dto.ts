import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BookingAddressDto {
  @ApiProperty({ example: '800001', description: '6-digit pincode' })
  zip: string;

  @ApiProperty({ example: '12 MG Road, Patna' })
  text: string;
}

export class CreateBookingDto {
  @ApiProperty()
  serviceId: string;

  @ApiProperty()
  subCategoryId: string;

  @ApiProperty({ example: '9876543210' })
  contactPhone: string;

  @ApiProperty({ type: BookingAddressDto })
  addressData: BookingAddressDto;

  @ApiPropertyOptional({ example: 'Not cooling' })
  description?: string;

  @ApiPropertyOptional()
  contactName?: string;

  @ApiPropertyOptional()
  contactEmail?: string;
}
