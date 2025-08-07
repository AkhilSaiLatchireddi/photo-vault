@echo off
echo Updating S3 CORS configuration...
aws s3api put-bucket-cors --bucket photovault-bucket --cors-configuration file://bucket-cors.json
if %errorlevel% equ 0 (
    echo CORS configuration updated successfully!
) else (
    echo Failed to update CORS configuration. Please check your AWS credentials and bucket name.
)
pause