# Fix Azure Container Registry Permissions

## Run these commands in Azure Cloud Shell:

```bash
# 1. Get your service principal ID (from AZURE_CREDENTIALS secret)
# Look for "clientId" in your AZURE_CREDENTIALS JSON

# 2. Assign AcrPush role to service principal
az role assignment create \
  --assignee YOUR_SERVICE_PRINCIPAL_CLIENT_ID \
  --role AcrPush \
  --scope /subscriptions/c95e7e87-1a65-4523-b57a-96931264f180/resourceGroups/Imago-mum/providers/Microsoft.ContainerRegistry/registries/imagomumregistry

# 3. Also assign Contributor role to the registry
az role assignment create \
  --assignee YOUR_SERVICE_PRINCIPAL_CLIENT_ID \
  --role Contributor \
  --scope /subscriptions/c95e7e87-1a65-4523-b57a-96931264f180/resourceGroups/Imago-mum/providers/Microsoft.ContainerRegistry/registries/imagomumregistry
```

## Alternative: Enable Admin User (Easier)

1. Go to Azure Portal → imagomumregistry → Access keys
2. Enable "Admin user" 
3. Copy new credentials to GitHub secrets
