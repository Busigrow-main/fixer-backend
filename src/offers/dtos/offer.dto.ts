import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOfferDto {
  @ApiProperty({ example: 'Shop 10' })
  title: string;

  @ApiProperty({ example: '10% OFF' })
  discountText: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'Limited time' })
  badge?: string;

  @ApiPropertyOptional({ example: 'SHOP10' })
  couponCode?: string;

  @ApiPropertyOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'Explore offer' })
  ctaLabel?: string;

  @ApiPropertyOptional({ example: '/shop' })
  ctaHref?: string;

  @ApiPropertyOptional({ enum: ['RED', 'DARK', 'BLUE', 'GOLD'] })
  theme?: string;

  @ApiPropertyOptional({ enum: ['ALL', 'SERVICES', 'SHOP'] })
  audience?: string;

  @ApiPropertyOptional()
  terms?: string;

  @ApiPropertyOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  startsAt?: string;

  @ApiPropertyOptional()
  endsAt?: string;

  @ApiPropertyOptional({ example: 0 })
  priority?: number;
}
