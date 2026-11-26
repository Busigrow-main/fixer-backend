# Graph Report - fixer-backend  (2026-11-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3282 nodes · 8889 edges · 135 communities (95 shown, 40 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 476 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b0a9e94`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AdminController
- UsersService
- appliance.schema.ts
- bookings.service.ts
- booking.schema.ts
- technician-platform.module.ts
- @nestjs/mongoose
- ShopPartHelpService
- package.json
- BookingsService
- OpsQueueService
- TechniciansService
- OffersService
- TechnicianEngineService
- FeedbackService
- technician-schedule.ts
- @nestjs/common
- leads.service.ts
- mongoose
- technician-engine.ts
- performance-summary.service.ts
- TechnicianPlatformAdminController
- class-validator
- @nestjs/swagger
- admin.controller.ts
- settlements.service.ts
- CustomerAppliancesService
- CurrentTechnician
- dependencies
- SettlementsService
- elasticsearch
- TechnicianOnboardingService
- ServicesService
- settlement.ts
- CheckoutService
- JobCompletionService
- ShopProductType
- GstBreakdownDto
- TechnicianAuthService
- JobSheetService
- build-shop-api-docx.py
- scripts
- PartOrdersService
- technician-onboarding.service.ts
- elasticsearch
- compilerOptions
- shop.module.ts
- steps
- upload-to-cloudinary.ts
- seed-appliances.ts
- fixxer-release.sh
- verify-images.ts
- CartController
- CreateCheckoutDto
- SparePartsController
- technician-onboarding.controller.ts
- gst.engine.ts
- PerformanceSummaryController
- steps
- scripts/seed-appliances.js
- seed-5000-parts.js
- customer-booking.helpers.ts
- CreatePartOrderDto
- cart.service.ts
- CartService
- RecordSettlementPaymentDto
- merge-and-seed.ts
- technician-jobs.controller.ts
- scrape-product-images.ts
- WishlistController
- OnboardingAnalyticsService
- NotificationsController
- technicians.service.ts
- dotenv
- seed-spare-parts-v2.js
- ShopService
- PartOrdersController
- .update
- seed-spare-parts.js
- bill-email.service.ts
- paths.ts
- EarningsController
- wishlist.controller.ts
- AzureEmailService
- BookingsController
- seed.js
- EmailService
- TechnicianDashboardController
- TechnicianVerificationService
- VisitsController
- BillEmailService
- part-order.schema.ts
- SparePartsService
- AddCartItemDto
- TechnicianSparePartsController
- app.controller.ts
- fixxer-code.ts
- job-sheet-defaults.ts
- part-orders.service.ts
- SearchService
- EmailPreviewController
- jest
- Prop
- UpdateOrderBillDto
- email.service.ts
- fix-spare-part-unit-prices.js
- categoriesForServiceSlug
- eslint.config.mjs
- @nestjs/schedule
- ShopPartHelpQueryDto
- cart.schema.ts
- booking-change-history.ts
- SettlementStatus
- nest-cli.json
- search.module.ts
- seed-services.js
- seed-appliances.js
- BookingSlotShiftScheduler
- bookings.controller.ts
- image-urls.ts
- seed-admin.js
- invoice-pdf.ts
- UpdateOpsSettingsDto
- SettlementPaymentStatus
- fixxer-autodeploy.sh
- seed-allowed-pincodes.ts
- backup-mongo.sh
- deploy.sh
- install-autodeploy.sh
- seed-fresh.sh
- setup-ec2.sh

## God Nodes (most connected - your core abstractions)
1. `@nestjs/common` - 152 edges
2. `@nestjs/mongoose` - 132 edges
3. `mongoose` - 129 edges
4. `BookingsService` - 84 edges
5. `AdminController` - 56 edges
6. `CurrentTechnician` - 56 edges
7. `TechniciansService` - 52 edges
8. `BookingDocument` - 52 edges
9. `Booking` - 50 edges
10. `SparePartsService` - 50 edges

## Surprising Connections (you probably didn't know these)
- `computeInvoiceTotals()` --calls--> `breakdownInvoice()`  [EXTRACTED]
  src/part-orders/part-orders.service.ts → src/gst/gst.engine.ts
- `AdminController` --references--> `Roles()`  [EXTRACTED]
  src/admin/admin.controller.ts → src/auth/decorators/roles.decorator.ts
- `TechnicianPlatformAdminController` --references--> `Roles()`  [EXTRACTED]
  src/technician-platform/admin/technician-platform-admin.controller.ts → src/auth/decorators/roles.decorator.ts
- `TechnicianJobsController` --references--> `RequireActiveTechnician()`  [EXTRACTED]
  src/technician-platform/jobs/technician-jobs.controller.ts → src/technician-platform/common/require-active.decorator.ts
- `JobCompletionController` --references--> `RequireActiveTechnician()`  [EXTRACTED]
  src/technician-platform/job-completion/job-completion.controller.ts → src/technician-platform/common/require-active.decorator.ts

## Import Cycles
- None detected.

## Communities (135 total, 40 thin omitted)

### Community 0 - "AdminController"
Cohesion: 0.06
Nodes (7): AdminController, csv, excelCellValue(), parseServiceDay(), toSlot(), AdminService, CustomerServiceHistoryService

### Community 1 - "UsersService"
Cohesion: 0.06
Nodes (20): passport-jwt@^4.0.1, passport-jwt, AuthController, AuthService, AuthTokenResponseDto, GoogleLoginDto, LoginDto, QuickLoginDto (+12 more)

### Community 2 - "appliance.schema.ts"
Cohesion: 0.06
Nodes (37): APPLIANCE_CATEGORIES, APPLIANCE_TYPE_ALIASES, ApplianceCategory, assertApplianceCategory(), resolveApplianceCategory(), AppliancesController, AppliancesService, ApplianceResponseDto (+29 more)

### Community 3 - "bookings.service.ts"
Cohesion: 0.08
Nodes (23): mongodb-memory-server, @nestjs/testing, AssignSlotInput, SLOT_END_MINUTES, GstService, ServiceablePincode, ServiceablePincodeDocument, ServiceablePincodesService (+15 more)

### Community 4 - "booking.schema.ts"
Cohesion: 0.05
Nodes (34): AdditionalChargeSchema, AddressDataSchema, Booking, BOOKING_CHANGE_ACTOR_ROLES, BookingChangeHistoryEntrySchema, BookingDocument, GpsLocationSchema, InvoiceDataSchema (+26 more)

### Community 5 - "technician-platform.module.ts"
Cohesion: 0.07
Nodes (31): AdminModule, AppModule, AuthModule, BookingsModule, BookingSchema, CustomerAppliancesModule, GstModule, OpsModule (+23 more)

### Community 6 - "@nestjs/mongoose"
Cohesion: 0.07
Nodes (33): @nestjs/mongoose, AppliancesModule, Appliance, ApplianceSchema, PartOrderSchema, BRANDS, buildAppliances(), buildParts() (+25 more)

### Community 7 - "ShopPartHelpService"
Cohesion: 0.05
Nodes (5): CreateShopPartHelpDto, ShopPartHelpContactDto, QuoteShopPartHelpDto, ShopPartHelpController, ShopPartHelpService

### Community 8 - "package.json"
Cohesion: 0.05
Nodes (60): author, description, devDependencies, eslint@^9.18.0, eslint-config-prettier@^10.0.1, @eslint/eslintrc@^3.2.0, jest@^30.0.0, mongodb-memory-server@^11.2.0 (+52 more)

### Community 9 - "BookingsService"
Cohesion: 0.09
Nodes (8): BookingAuditContext, BookingChangeEventInput, BookingsService, getServiceNow(), isTechOccupyingStatus(), isFixxerStaff(), slotCheckHasClash(), collectPartsFromVisits()

### Community 10 - "OpsQueueService"
Cohesion: 0.05
Nodes (11): UpdateOpsPendingWorkDto, OpsController, OpsQueueScheduler, formatAge(), OpsQueueService, OpsSettingsService, OpsThresholds, DEFAULT_OPS_THRESHOLDS (+3 more)

### Community 11 - "TechniciansService"
Cohesion: 0.06
Nodes (3): TechniciansController, build(), TechniciansService

### Community 12 - "OffersService"
Cohesion: 0.06
Nodes (13): AdminOffersController, OffersController, OffersModule, OfferInput, OffersService, Offer, OFFER_AUDIENCES, OFFER_THEMES (+5 more)

### Community 13 - "TechnicianEngineService"
Cohesion: 0.08
Nodes (11): omitTechnicianForbiddenBookingFields(), availabilityForJobEvent(), isPreArrivalJobEvent(), TechnicianEngineService, toHttp(), buildJobsService(), buildProfile(), buildService() (+3 more)

### Community 14 - "FeedbackService"
Cohesion: 0.06
Nodes (4): FeedbackFollowUpQueryDto, SubmitFeedbackDto, FeedbackController, FeedbackService

### Community 15 - "technician-schedule.ts"
Cohesion: 0.10
Nodes (33): assertNotInPast(), assertValidSlot(), cascade(), describeSlotClash(), formatServiceTime(), freeSlots(), holdingWindowsSorted(), holdsSlot() (+25 more)

### Community 16 - "@nestjs/common"
Cohesion: 0.08
Nodes (16): bcrypt, @nestjs/common, @nestjs/jwt, EmailOtpSession, EmailOtpSessionDocument, EmailOtpSessionSchema, assertValidCalendarDate(), isValidCalendarDate() (+8 more)

### Community 17 - "leads.service.ts"
Cohesion: 0.06
Nodes (16): CreateLeadDto, LeadsController, LeadsModule, LeadsService, Lead, LeadDocument, LeadSchema, LeadStatus (+8 more)

### Community 18 - "mongoose"
Cohesion: 0.10
Nodes (17): mongoose, MapApplianceInput, CustomerAppliance, CustomerApplianceDocument, CustomerApplianceSchema, FeedbackModule, FEEDBACK_ELIGIBLE_STATUSES, FeedbackFollowUp (+9 more)

### Community 19 - "technician-engine.ts"
Cohesion: 0.11
Nodes (34): activeJobQuery(), assertAssignableTechnician(), assertAssignmentAccepted(), assertAvailabilityStatus(), assertBookingAssignable(), assertBookingStatusTransition(), assertCanAcceptAssignment(), assertCanClaimJob() (+26 more)

### Community 20 - "performance-summary.service.ts"
Cohesion: 0.08
Nodes (22): supertest, PerformanceSummaryModule, PerformanceSummaryScheduler, ACTIVE_BOOKING_STATUSES, businessDateFromInstant(), DateWindow, isDuplicateKeyError(), parseBusinessDate() (+14 more)

### Community 22 - "class-validator"
Cohesion: 0.06
Nodes (7): class-transformer, class-validator, UpdateFeedbackFollowUpDto, FEEDBACK_FOLLOW_UP_STATUSES, CreateServiceablePincodeDto, UpdateServiceablePincodeDto, RejectApplicationDto

### Community 23 - "@nestjs/swagger"
Cohesion: 0.21
Nodes (10): @nestjs/core, @nestjs/passport, @nestjs/swagger, Roles(), ROLES_KEY, RolesGuard, JWT_AUTH, CreateOfferDto (+2 more)

### Community 24 - "admin.controller.ts"
Cohesion: 0.13
Nodes (26): ActiveBodyDto, ArrivalDto, AssignTechnicianDto, AvailabilityDto, BookingIdDto, BookingSlotDto, BookingStatusDto, FixxerCodeDto (+18 more)

### Community 25 - "settlements.service.ts"
Cohesion: 0.13
Nodes (18): Earning, EarningDocument, EarningSchema, SettlementItem, SettlementItemClaimStatus, CLAIMED, FINALIZED, RELEASED (+10 more)

### Community 26 - "CustomerAppliancesService"
Cohesion: 0.12
Nodes (3): AdminApplianceMappingsController, CustomerAppliancesController, CustomerAppliancesService

### Community 28 - "dependencies"
Cohesion: 0.06
Nodes (35): dependencies, axios@^1.16.1, bcrypt@^6.0.0, class-transformer@^0.5.1, class-validator@^0.15.1, cloudinary@^2.10.0, csv-parser@^3.2.0, @elastic/elasticsearch@^9.3.4 (+27 more)

### Community 29 - "SettlementsService"
Cohesion: 0.12
Nodes (4): SettlementsController, businessDate(), isDuplicateKeyError(), SettlementsService

### Community 30 - "elasticsearch"
Cohesion: 0.07
Nodes (32): container_name, environment, healthcheck, image, logging, ports, profiles, restart (+24 more)

### Community 32 - "ServicesService"
Cohesion: 0.10
Nodes (4): CreateServiceDto, ServiceSubCategoryDto, ServicesController, ServicesService

### Community 33 - "settlement.ts"
Cohesion: 0.12
Nodes (27): adapt(), rootParentId(), usagesForBooking(), idStr(), isOidHex(), isPaidBooking(), isWarrantyClaim(), originalCoveredAt() (+19 more)

### Community 35 - "JobCompletionService"
Cohesion: 0.14
Nodes (3): JobCompletionController, JobCompletionService, presentCompletionBooking()

### Community 36 - "ShopProductType"
Cohesion: 0.14
Nodes (8): InstallationService, ShopWishlist, ShopWishlistDocument, ShopWishlistItem, ShopWishlistItemSchema, ShopWishlistSchema, ShopProductType, WishlistService

### Community 37 - "GstBreakdownDto"
Cohesion: 0.12
Nodes (4): GstController, GstBreakdownDto, GstExtractDto, GstLineDto

### Community 38 - "TechnicianAuthService"
Cohesion: 0.12
Nodes (3): TechnicianAuthController, TechnicianAuthService, OtpService

### Community 40 - "build-shop-api-docx.py"
Cohesion: 0.16
Nodes (18): add_bottom_border(), add_code_block(), add_footer(), add_html_table(), add_method_heading(), add_rich_paragraph(), walk(), configure_styles() (+10 more)

### Community 41 - "scripts"
Cohesion: 0.07
Nodes (27): scripts, ac:merge, ac:pipeline, ac:scrape, ac:seed, ac:upload, ac:verify, build (+19 more)

### Community 42 - "PartOrdersService"
Cohesion: 0.15
Nodes (4): isShopOrderCancellable(), PartOrdersService, PartOrder, PartOrderDocument

### Community 43 - "technician-onboarding.service.ts"
Cohesion: 0.09
Nodes (12): OnboardingStatusResponse, AllowedPincode, AllowedPincodeDocument, AllowedPincodeSchema, OnboardingCall, OnboardingCallDocument, OnboardingCallSchema, OnboardingEvent (+4 more)

### Community 44 - "elasticsearch"
Cohesion: 0.09
Nodes (25): container_name, driver, environment, healthcheck, image, ports, volumes, interval (+17 more)

### Community 45 - "compilerOptions"
Cohesion: 0.08
Nodes (24): exclude, extends, compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, esModuleInterop (+16 more)

### Community 46 - "shop.module.ts"
Cohesion: 0.16
Nodes (6): SHOP_SETTINGS_KEY, ShopSettings, ShopSettingsDocument, ShopSettingsSchema, ShopMaintenanceGuard, ShopSettingsService

### Community 47 - "steps"
Cohesion: 0.09
Nodes (22): env, runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, NEXT_PUBLIC_API_URL (+14 more)

### Community 48 - "upload-to-cloudinary.ts"
Cohesion: 0.15
Nodes (20): isImageFile(), listImageFiles(), SEED_JSON, buildSkuIndex(), loadSeedProducts(), slugForSku(), AcStockType, AcStockUploadFile (+12 more)

### Community 49 - "seed-appliances.ts"
Cohesion: 0.15
Nodes (22): applyPricing(), buildDescriptionSections(), buildTechnicalDescription(), coolingBtu(), DATA_JSON, DescriptionSection, DescriptionSectionType, loadProducts() (+14 more)

### Community 50 - "fixxer-release.sh"
Cohesion: 0.22
Nodes (21): build_release(), current_release(), data_services(), deploy_app(), die(), HEALTH, health_check(), list_app() (+13 more)

### Community 51 - "verify-images.ts"
Cohesion: 0.12
Nodes (18): fileSha256(), ImageDimensions, ImageValidationOptions, ImageValidationResult, readDimensionsFromBuffer(), readImageDimensions(), DEFAULT_MIN_GALLERY_BYTES, DEFAULT_MIN_HEIGHT (+10 more)

### Community 53 - "CreateCheckoutDto"
Cohesion: 0.13
Nodes (4): CheckoutQuoteDto, CreateCheckoutDto, InstallationOptionsQueryDto, InstallationController

### Community 55 - "technician-onboarding.controller.ts"
Cohesion: 0.15
Nodes (8): paymentWebhookSecret(), webhookSecretMatches(), JobCompletionBodyDto, MapSerialDto, OnboardingCallDto, OnboardingEventDto, ReturnInventoryPartDto, UploadVerificationDocumentDto

### Community 56 - "gst.engine.ts"
Cohesion: 0.22
Nodes (16): applyExclusiveTax(), breakdownInvoice(), breakdownLine(), extractInclusiveTax(), roundMoney(), splitTaxComponents(), FIXXER_AC_SERVICE_SAC, FIXXER_SERVICE_GST_PERCENT (+8 more)

### Community 58 - "steps"
Cohesion: 0.10
Nodes (19): runs-on, steps, timeout-minutes, concurrency, cancel-in-progress, group, jobs, build (+11 more)

### Community 59 - "scripts/seed-appliances.js"
Cohesion: 0.15
Nodes (16): { MongoClient }, buildDescription(), envPath, fs, buildHighlights(), buildProduct(), calcPrice(), main() (+8 more)

### Community 60 - "seed-5000-parts.js"
Cohesion: 0.14
Nodes (19): APPLIANCE_TYPES, BRANDS, COMMON_PART_CATEGORIES, generateDescription(), generateName(), generatePartNumber(), generatePrice(), generateSKU() (+11 more)

### Community 61 - "customer-booking.helpers.ts"
Cohesion: 0.17
Nodes (13): AWAITING_ASSIGNMENT, buildCustomerPricingSummary(), CUSTOMER_STATUS_STEPS, CustomerPricingSummary, CustomerStatusTone, CustomerStatusView, getCustomerStatusView(), pickUpcomingVisitSchedule() (+5 more)

### Community 62 - "CreatePartOrderDto"
Cohesion: 0.14
Nodes (4): ApplianceOrderItemDto, ContactDataDto, CreatePartOrderDto, OrderItemDto

### Community 63 - "cart.service.ts"
Cohesion: 0.23
Nodes (14): InstallationOption, applianceToShopCard(), applyDiscount(), DELIVERY_CHARGE_RUPEES, discountPercent(), formatBrand(), INSTALLATION_CHARGES, money() (+6 more)

### Community 64 - "CartService"
Cohesion: 0.24
Nodes (3): cartLineId(), CartService, ShopCartDocument

### Community 65 - "RecordSettlementPaymentDto"
Cohesion: 0.16
Nodes (8): SettlementReconciliationStatus, DISPUTED, MATCHED, PENDING, PrepareSettlementsDto, ReconcileSettlementDto, RecordSettlementPaymentDto, RejectSettlementDto

### Community 66 - "merge-and-seed.ts"
Cohesion: 0.22
Nodes (15): getArg(), getArgNumber(), parseArgs(), IMAGES_ROOT, applyImagesToSections(), main(), mergeManifestIntoSeed(), runSeed() (+7 more)

### Community 67 - "technician-jobs.controller.ts"
Cohesion: 0.27
Nodes (5): PaymentMethodDto, CurrentUser, RequireActiveTechnician(), REQUIRE_ACTIVE_KEY, TechnicianGuard

### Community 68 - "scrape-product-images.ts"
Cohesion: 0.23
Nodes (17): downloadImage(), extFromUrl(), IMAGE_EXT, normalizeImageUrl(), sleep(), validateImageFile(), skuImageDir(), collectRawImageUrls() (+9 more)

### Community 70 - "OnboardingAnalyticsService"
Cohesion: 0.14
Nodes (3): OnboardingAnalyticsService, OnboardingProgressHelper, OnboardingEventDocument

### Community 72 - "technicians.service.ts"
Cohesion: 0.16
Nodes (7): Notification, NotificationDocument, NotificationSchema, VerificationDocument, VerificationDocumentDocument, VerificationDocumentSchema, EMPLOYMENT_TYPES

### Community 73 - "dotenv"
Cohesion: 0.12
Nodes (10): dotenv@^17.4.2, serviceablePincodes, dotenv, NON_OCCUPYING, images, SeedItem, seedItems, seedShopAppliances() (+2 more)

### Community 74 - "seed-spare-parts-v2.js"
Cohesion: 0.12
Nodes (17): ApplianceType, applianceTypes, ApplianceTypeSchema, Brand, brands, BrandSchema, CategoryTree, CategoryTreeSchema (+9 more)

### Community 78 - "seed-spare-parts.js"
Cohesion: 0.12
Nodes (15): ApplianceType, applianceTypes, ApplianceTypeSchema, Brand, BrandSchema, brandsData, CategoryTree, CategoryTreeSchema (+7 more)

### Community 79 - "bill-email.service.ts"
Cohesion: 0.36
Nodes (14): appBase(), BookingMailInput, buildAssignmentEmail(), buildBillEmail(), buildConfirmationEmail(), buildEmailPreviewPage(), ConfirmationMailInput, facts() (+6 more)

### Community 80 - "paths.ts"
Cohesion: 0.21
Nodes (14): ENV_PATH, MANIFEST_JSON, PIPELINE_ROOT, STOCK_UPLOAD_JSON, VERIFY_REPORT_JSON, filterBySku(), loadStockUpload(), parseCapacityTon() (+6 more)

### Community 82 - "wishlist.controller.ts"
Cohesion: 0.17
Nodes (5): AddWishlistItemDto, SoftWishlistSnapshotDto, SyncWishlistDto, WishlistItemIdParams, WishlistItemRefDto

### Community 83 - "AzureEmailService"
Cohesion: 0.18
Nodes (8): @azure/communication-email@^1.1.0, @azure/communication-email, AzureEmailService, appBaseUrl(), BRAND, buildOtpEmail(), escapeHtml(), OtpEmailContent

### Community 85 - "seed.js"
Cohesion: 0.17
Nodes (14): exceljs@^4.4.0, exceljs, cleanAndTransformRow(), COLUMN_MAP, defaultFilePath, excelCellValue(), ExcelJS, fs (+6 more)

### Community 91 - "part-order.schema.ts"
Cohesion: 0.26
Nodes (10): ApplianceOrderItem, ApplianceOrderItemSchema, BillLineItem, BillLineItemSchema, InvoiceSoldBy, InvoiceSoldBySchema, OrderInvoiceData, OrderInvoiceDataSchema (+2 more)

### Community 93 - "AddCartItemDto"
Cohesion: 0.27
Nodes (3): AddCartItemDto, ApplyCouponDto, UpdateCartItemDto

### Community 96 - "fixxer-code.ts"
Cohesion: 0.27
Nodes (9): sealCode(), decryptFixxerCode(), encryptionKey(), FixxerCodeFields, fixxerCodeKey(), fixxerCodesMatch(), issueFixxerCode(), SECRET_FIELDS (+1 more)

### Community 97 - "job-sheet-defaults.ts"
Cohesion: 0.27
Nodes (9): addMonths(), blank(), buildJobSheetDefaults(), formatDate(), isGeneratedWarrantyDesc(), JobSheetPart, partLabel(), partsFromVisits() (+1 more)

### Community 98 - "part-orders.service.ts"
Cohesion: 0.29
Nodes (7): plainText(), sanitizeContact(), computeInvoiceTotals(), CreatePartOrderOptions, CUSTOMER_CANCELLABLE, isShopInvoicePosted(), USER_PUBLIC_POPULATE

### Community 102 - "jest"
Cohesion: 0.18
Nodes (11): node, jest, collectCoverageFrom, coverageDirectory, engines, moduleFileExtensions, rootDir, testEnvironment (+3 more)

### Community 103 - "Prop"
Cohesion: 0.33
Nodes (9): AdditionalCharge, AddressData, BookingChangeHistoryEntry, GpsLocation, InvoiceData, JobCompletionData, JobDetails, ProductDetails (+1 more)

### Community 104 - "UpdateOrderBillDto"
Cohesion: 0.24
Nodes (3): BillLineItemDto, InvoiceSoldByDto, UpdateOrderBillDto

### Community 105 - "email.service.ts"
Cohesion: 0.31
Nodes (9): RFC-2047, buildMimeMessage(), EmailAttachment, EmailMessage, encodeAddress(), encodeHeader(), Provider, safeFilename() (+1 more)

### Community 106 - "fix-spare-part-unit-prices.js"
Cohesion: 0.27
Nodes (8): BRAND_LABEL, brandLabel(), CATEGORY_PART_NAMES, mongoose, pick(), run(), UNIT_PRICE_RUPEES, unitPaise()

### Community 107 - "categoriesForServiceSlug"
Cohesion: 0.29
Nodes (4): SlotEligibility, categoriesForServiceSlug(), SERVICE_SLUG_TO_CATEGORIES, technicianOffersCategories()

### Community 108 - "eslint.config.mjs"
Cohesion: 0.22
Nodes (8): @eslint/js@^9.18.0, eslint-plugin-prettier@^5.2.2, globals@^17.0.0, typescript-eslint@^8.20.0, @eslint/js, eslint-plugin-prettier, globals, typescript-eslint

### Community 109 - "@nestjs/schedule"
Cohesion: 0.28
Nodes (3): @nestjs/schedule@^6.1.3, @nestjs/schedule, SettlementScheduler

### Community 112 - "cart.schema.ts"
Cohesion: 0.33
Nodes (6): ShopCart, ShopCartCoupon, ShopCartCouponSchema, ShopCartItem, ShopCartItemSchema, ShopCartSchema

### Community 113 - "booking-change-history.ts"
Cohesion: 0.32
Nodes (6): BOOKING_AUDIT_FIELDS, BookingAuditActorRole, BookingAuditField, buildChangeEvent(), normalizeAuditValue(), TECHNICIAN_OMIT_BOOKING_FIELDS

### Community 114 - "SettlementStatus"
Cohesion: 0.25
Nodes (8): SettlementStatus, APPROVED, CANCELLED, PAID, PREPARATION_FAILED, PREPARED, PREPARING, REJECTED

### Community 115 - "nest-cli.json"
Cohesion: 0.29
Nodes (6): collection, compilerOptions, deleteOutDir, plugins, $schema, sourceRoot

### Community 116 - "search.module.ts"
Cohesion: 0.33
Nodes (4): @nestjs/elasticsearch@^11.1.0, @nestjs/elasticsearch, SearchModule, PARTS_INDEX

### Community 117 - "seed-services.js"
Cohesion: 0.29
Nodes (5): mongoose, Service, SERVICES_DATA, ServiceSchema, SubCategorySchema

### Community 118 - "seed-appliances.js"
Cohesion: 0.33
Nodes (4): Appliance, applianceSchema, godrejACs, mongoose

### Community 121 - "image-urls.ts"
Cohesion: 0.60
Nodes (5): filterAndRankImageUrls(), imageContentKey(), isProductImageUrl(), isRejectedImageUrl(), upscaleMarketplaceImageUrl()

### Community 122 - "seed-admin.js"
Cohesion: 0.40
Nodes (3): bcrypt, mongoose, UserSchema

### Community 123 - "invoice-pdf.ts"
Cohesion: 0.60
Nodes (4): buildInvoicePdf(), inr(), InvoicePdfInput, partWarrantyNote()

### Community 125 - "SettlementPaymentStatus"
Cohesion: 0.40
Nodes (5): SettlementPaymentStatus, FAILED, NOT_INITIATED, PENDING, SUCCESS

## Knowledge Gaps
- **32 isolated node(s):** `RFC-2047`, `APPROVED`, `CANCELLED`, `PAID`, `PREPARATION_FAILED` (+27 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 970 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@nestjs/common` connect `@nestjs/common` to `UsersService`, `appliance.schema.ts`, `bookings.service.ts`, `booking.schema.ts`, `technician-platform.module.ts`, `@nestjs/mongoose`, `package.json`, `OpsQueueService`, `OffersService`, `TechnicianEngineService`, `technician-schedule.ts`, `leads.service.ts`, `mongoose`, `technician-engine.ts`, `performance-summary.service.ts`, `@nestjs/swagger`, `admin.controller.ts`, `settlements.service.ts`, `dependencies`, `GstBreakdownDto`, `technician-onboarding.service.ts`, `shop.module.ts`, `technician-onboarding.controller.ts`, `cart.service.ts`, `technician-jobs.controller.ts`, `technicians.service.ts`, `bill-email.service.ts`, `wishlist.controller.ts`, `AzureEmailService`, `app.controller.ts`, `part-orders.service.ts`, `email.service.ts`, `@nestjs/schedule`, `search.module.ts`, `bookings.controller.ts`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **What connects `RFC-2047`, `APPROVED`, `CANCELLED` to the rest of the system?**
  _32 weakly-connected nodes found - possible missing edges._
- **Should `AdminController` be split into smaller, more focused modules?**
  _Cohesion score 0.059822361546499475 - nodes in this community are weakly interconnected._
- **Why does `mongoose` connect `mongoose` to `appliance.schema.ts`, `bookings.service.ts`, `booking.schema.ts`, `technician-platform.module.ts`, `@nestjs/mongoose`, `package.json`, `OpsQueueService`, `TechniciansService`, `OffersService`, `TechnicianEngineService`, `technician-schedule.ts`, `@nestjs/common`, `leads.service.ts`, `performance-summary.service.ts`, `settlements.service.ts`, `dependencies`, `settlement.ts`, `ShopProductType`, `technician-onboarding.service.ts`, `shop.module.ts`, `seed-appliances.ts`, `seed-5000-parts.js`, `cart.service.ts`, `technicians.service.ts`, `dotenv`, `seed-spare-parts-v2.js`, `seed-spare-parts.js`, `bill-email.service.ts`, `seed.js`, `part-order.schema.ts`, `part-orders.service.ts`, `fix-spare-part-unit-prices.js`, `cart.schema.ts`, `booking-change-history.ts`, `seed-services.js`, `seed-appliances.js`, `seed-admin.js`, `seed-allowed-pincodes.ts`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `UsersService` be split into smaller, more focused modules?**
  _Cohesion score 0.05569620253164557 - nodes in this community are weakly interconnected._
- **Why does `@nestjs/mongoose` connect `@nestjs/mongoose` to `appliance.schema.ts`, `bookings.service.ts`, `booking.schema.ts`, `technician-platform.module.ts`, `package.json`, `OpsQueueService`, `OffersService`, `technician-schedule.ts`, `@nestjs/common`, `leads.service.ts`, `mongoose`, `performance-summary.service.ts`, `settlements.service.ts`, `dependencies`, `ShopProductType`, `technician-onboarding.service.ts`, `shop.module.ts`, `cart.service.ts`, `technicians.service.ts`, `bill-email.service.ts`, `part-order.schema.ts`, `part-orders.service.ts`, `cart.schema.ts`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Should `appliance.schema.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05664556962025316 - nodes in this community are weakly interconnected._