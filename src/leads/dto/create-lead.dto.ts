import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
  } from 'class-validator';
  
  import { LeadType } from '../schemas/lead.schema';
  
  export class CreateLeadDto {
    @IsEnum(LeadType)
    type: LeadType;
  
    @IsString()
    @IsNotEmpty()
    name: string;
  
    @IsString()
    @Matches(/^\d{10}$/, {
      message: 'Phone must be a valid 10-digit number',
    })
    phone: string;
  
    @IsOptional()
    @IsEmail()
    email?: string;
  
    // Business fields
    @IsOptional()
    @IsString()
    shopName?: string;
  
    @IsOptional()
    @IsString()
    shopAddress?: string;
  
    // Technician fields
    @IsOptional()
    @IsString()
    address?: string;
  
    @IsOptional()
    @IsString()
    applianceExpertise?: string;
  }